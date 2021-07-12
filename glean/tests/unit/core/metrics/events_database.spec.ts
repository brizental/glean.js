/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import assert from "assert";
import Glean from "../../../../src/core/glean";

import { Lifetime } from "../../../../src/core/metrics/lifetime";
import EventsDatabase from "../../../../src/core/metrics/events_database";
import EventMetricType from "../../../../src/core/metrics/types/event";
import type { JSONObject } from "../../../../src/core/utils";
import CounterMetricType from "../../../../src/core/metrics/types/counter";
import { generateReservedMetricIdentifiers } from "../../../../src/core/metrics/database";
import PingType from "../../../../src/core/pings/ping_type";
import { Context } from "../../../../src/core/context";
import { RecordedEvent } from "../../../../src/core/metrics/events_database/recorded_event";
import { GLEAN_EXECUTION_COUNTER_EXTRA_KEY } from "../../../../src/core/constants";

describe("EventsDatabase", function() {
  const testAppId = `gleanjs.test.${this.title}`;

  beforeEach(async function() {
    await Glean.testResetGlean(testAppId);
  });

  it("stable serialization", function () {
    const event_empty = new RecordedEvent(
      "cat",
      "name",
      2,
      // Intentional, no extra.
    );

    const event_data = new RecordedEvent(
      "cat",
      "name",
      2,
      {
        "a key": "a value",
      }
    );

    const event_empty_json = RecordedEvent.toJSONObject(event_empty);
    const event_data_json = RecordedEvent.toJSONObject(event_data);

    assert.deepStrictEqual(event_empty, RecordedEvent.fromJSONObject(event_empty_json));
    assert.deepStrictEqual(event_data, RecordedEvent.fromJSONObject(event_data_json));
  });

  it("deserialize existing data", function () {
    const event_empty_json = {
      "category": "cat",
      "extra": undefined,
      "name": "name",
      "timestamp": 2,
    };

    const event_data_json = {
      "category": "cat",
      "extra": {
        "a key": "a value"
      },
      "name": "name",
      "timestamp": 2,
    };

    const event_empty = RecordedEvent.fromJSONObject(event_empty_json);
    const event_data = RecordedEvent.fromJSONObject(event_data_json);

    assert.deepStrictEqual(
      event_empty_json,
      RecordedEvent.toJSONObject(event_empty)
    );
    assert.deepStrictEqual(event_data_json, RecordedEvent.toJSONObject(event_data));
  });

  // Note: "does not record if upload is disabled" was not ported from Rust. We
  // are only checking for upload being enabled in the metric type itself, to
  // reduce coupling across the components.

  it("getPingMetrics returns undefined if nothing is recorded", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const data = await db.getPingEvents("test-unknown-ping", true, new Date());

    assert.strictEqual(data, undefined);
  });

  it("getPingMetrics correctly clears the store", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const metric = new EventMetricType({
      category: "telemetry",
      name: "test_event_clear",
      sendInPings: ["store1", "store2"],
      lifetime: Lifetime.Ping,
      disabled: false
    });

    // We didn't record anything yet, so we don't expect anything to be
    // stored.
    let snapshot = await db.getPingEvents("store1", false, new Date());
    assert.strictEqual(snapshot, undefined);

    await db.record(metric, new RecordedEvent(
      "telemetry",
      "test_event_clear",
      1000,
    ));

    // Take a first snapshot and clear the recorded content.
    snapshot = await db.getPingEvents("store1", true, new Date());
    assert.ok(snapshot != undefined);

    // If we snapshot a second time, the store must be empty.
    const empty_snapshot = await db.getPingEvents("store1", false, new Date());
    assert.strictEqual(empty_snapshot, undefined);

    const store2 = await db.getPingEvents("store2", false, new Date());
    for (const events of [snapshot, store2]) {
      assert.ok(events != undefined);
      assert.strictEqual(1, events.length);
      const e = events[0] as JSONObject;
      assert.strictEqual("telemetry", e["category"]);
      assert.strictEqual("test_event_clear", e["name"]);
      assert.strictEqual(e["extra"], undefined);
    }
  });

  it("getPingMetrics sorts by timestamp", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const metric = new EventMetricType({
      category: "telemetry",
      name: "test_event_timestamp",
      sendInPings: ["store1"],
      lifetime: Lifetime.Ping,
      disabled: false
    });

    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      1000,
    ));

    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      100,
    ));

    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      10000,
    ));

    const snapshot = await db.getPingEvents("store1", true, new Date());
    assert.ok(snapshot);
    assert.strictEqual(3, snapshot.length);
    assert.strictEqual(0, (snapshot[0] as JSONObject)["timestamp"]);
    assert.strictEqual(900, (snapshot[1] as JSONObject)["timestamp"]);
    assert.strictEqual(9900, (snapshot[2] as JSONObject)["timestamp"]);
  });

  it("every recorded event gets an execution counter extra key", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const pings = ["aPing", "twoPing", "threePing"];
    const executionCounter = new CounterMetricType({
      ...generateReservedMetricIdentifiers("execution_counter"),
      sendInPings: pings,
      lifetime: Lifetime.Ping,
      disabled: false
    });
    const metric = new EventMetricType({
      category: "event",
      name: "test",
      sendInPings: pings,
      lifetime: Lifetime.Ping,
      disabled: false
    });

    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      100,
    ));

    for (const ping of pings) {
      assert.strictEqual(await executionCounter.testGetValue(ping), 1);
      // We need to use `getAndValidatePingData` here,
      // because the public function will strip reserved extra keys.
      const rawRecordedEvent = (await db["getAndValidatePingData"](ping))[0];
      assert.strictEqual(rawRecordedEvent.extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY], "1");
    }
  });

  it("execution counters are incremented when the database is initialized", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const pings = ["aPing", "twoPing", "threePing"];
    const executionCounter = new CounterMetricType({
      ...generateReservedMetricIdentifiers("execution_counter"),
      sendInPings: pings,
      lifetime: Lifetime.Ping,
      disabled: false
    });
    const metric = new EventMetricType({
      category: "event",
      name: "test",
      sendInPings: pings,
      lifetime: Lifetime.Ping,
      disabled: false
    });

    // Record events once, so that the events database has record of them.
    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      100,
    ));

    // Fake restart db a few times and check that execution counter goes up.
    for (let i = 1; i <= 10; i++) {
      for (const ping of pings) {
        assert.strictEqual(await executionCounter.testGetValue(ping), i);
      }
      const restartedDb = new EventsDatabase(Glean.platform.Storage);
      await restartedDb.initialize();
    }
  });

  it("execution counters are re-created if ping storage has been cleared", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const pings = ["aPing"];
    const executionCounter = new CounterMetricType({
      ...generateReservedMetricIdentifiers("execution_counter"),
      sendInPings: ["aPing"],
      lifetime: Lifetime.Ping,
      disabled: false
    });
    const metric = new EventMetricType({
      category: "event",
      name: "test",
      sendInPings: pings,
      lifetime: Lifetime.Ping,
      disabled: false
    });
    const ping = new PingType({
      name: "aPing",
      includeClientId: true,
      sendIfEmpty: false
    });

    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      100,
    ));
    // We expect only one event, execution counter 1.
    const rawRecordedEvents1 = (await db["getAndValidatePingData"]("aPing"));
    assert.strictEqual(rawRecordedEvents1[0].extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY], "1");

    // Fake restart Glean and recorde a new event.
    const restartedDb = new EventsDatabase(Glean.platform.Storage);
    await restartedDb.initialize();
    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      100,
    ));

    // We expect two events here, one execution counter 1, the other 2.
    const rawRecordedEvents2 = (await db["getAndValidatePingData"]("aPing"))
      .sort((a, b) => {
        const executionCounterA = parseInt(a.extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY] || "0");
        const executionCounterB = parseInt(b.extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY] || "0");
        return executionCounterA - executionCounterB;
      });
    assert.strictEqual(rawRecordedEvents2[0].extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY], "1");
    assert.strictEqual(rawRecordedEvents2[1].extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY], "2");

    ping.submit();
    // Sanity check that the execution counter was cleared.
    assert.strictEqual(await executionCounter.testGetValue("aPing"), undefined);

    await db.record(metric, new RecordedEvent(
      metric.category,
      metric.name,
      100,
    ));

    // We expect only one event, the other have been cleared, execution counter 1.
    const rawRecordedEvents3 = (await db["getAndValidatePingData"]("aPing"));
    assert.strictEqual(rawRecordedEvents3[0].extra?.[GLEAN_EXECUTION_COUNTER_EXTRA_KEY], "1");
  });

  it("reserved extra properties are removed from the recorded events", async function () {
    // Clear any events from previous tests.
    const rawStorage = new Glean.platform.Storage("events");
    await rawStorage.delete([]);
    assert.deepStrictEqual({}, await rawStorage._getWholeStore());

    // Initialize the database and inject some events.
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const metric = new EventMetricType({
      category: "event",
      name: "test",
      sendInPings: ["store1"],
      lifetime: Lifetime.Ping,
      disabled: false
    });
    // Record an initial event.
    await db.record(metric, new RecordedEvent(metric.category, metric.name, 10));

    const snapshot = await db.getPingEvents("store1", true, new Date());
    assert.ok(snapshot);
    assert.strictEqual(1, snapshot.length);

    const e = RecordedEvent.fromJSONObject(snapshot[0] as JSONObject);
    assert.strictEqual(e.extra, undefined);
  });

  it("glean.restarted events are properly injected when initializing", async function () {
    const db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    const stores = ["store1", "store2"];

    // Record some events.
    const event = new EventMetricType({
      category: "test",
      name: "event_injection",
      sendInPings: stores,
      lifetime: Lifetime.Ping,
      disabled: false
    });

    await db.record(event, new RecordedEvent(
      event.category,
      event.name,
      1000,
    ));

    // Simulate a restart and use the new DB to check for injected events.
    const db2 = new EventsDatabase(Glean.platform.Storage);
    await db2.initialize();

    for (const store of stores) {
      const snapshot = await db2.getPingEvents(store, true, new Date());
      assert.ok(snapshot);
      assert.strictEqual(2, snapshot.length);
      assert.strictEqual("test", (snapshot[0] as JSONObject)["category"]);
      assert.strictEqual("event_injection", (snapshot[0] as JSONObject)["name"]);
      assert.strictEqual("glean", (snapshot[1] as JSONObject)["category"]);
      assert.strictEqual("restarted", (snapshot[1] as JSONObject)["name"]);
    }
  });

  it("events are correctly sorted by execution counter and timestamp throughout restarts", async function() {
    // Initialize the database and inject some events.
    let db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    for (let i = 0; i < 10; i++) {
      const event = new EventMetricType({
        category: "test",
        name: `stichting_test_${i}`,
        sendInPings: ["store"],
        lifetime: Lifetime.Ping,
        disabled: false
      });

      await db.record(event, new RecordedEvent(event.category, event.name, 1000));

      // Move the clock forward by one minute.
      Context.startTime.setTime(Context.startTime.getTime() + 1000 * 60);
      // Fake a re-start.
      db = new EventsDatabase(Glean.platform.Storage);
      await db.initialize();
    }

    const snapshot = await db.getPingEvents("store", true, new Date());
    assert.ok(snapshot);

    // First event snapshot is always 0.
    const [ firstEvent, ...subsequentEvents ] = snapshot;
    assert.strictEqual(RecordedEvent.fromJSONObject(firstEvent as JSONObject).timestamp, 0);

    // Make sure subsequent timestamps are strictly increasing.
    let prevTime = 0;
    for (const event of subsequentEvents) {
      const e = RecordedEvent.fromJSONObject(event as JSONObject);
      assert.ok(e.timestamp > prevTime);
      prevTime = e.timestamp;
    }

    // Make sure the found events are the expected events.
    for (let i = 0; i < 10; i++) {
      assert.strictEqual("test", (snapshot[i * 2] as JSONObject)["category"]);
      assert.strictEqual(`stichting_test_${i}`, (snapshot[i * 2] as JSONObject)["name"]);
      assert.strictEqual("glean", (snapshot[(i * 2) + 1] as JSONObject)["category"]);
      assert.strictEqual("restarted", (snapshot[(i * 2) + 1] as JSONObject)["name"]);
    }
  });

  it("events are correctly sorted if time decides to go backwards throughout restarts", async function() {
    // Initialize the database and inject some events.
    let db = new EventsDatabase(Glean.platform.Storage);
    await db.initialize();

    for (let i = 0; i < 10; i++) {
      const event = new EventMetricType({
        category: "test",
        name: `time_travel_${i}`,
        sendInPings: ["store"],
        lifetime: Lifetime.Ping,
        disabled: false
      });

      await db.record(event, new RecordedEvent(event.category, event.name, 1000));

      // Move the clock backwards by one hour.
      Context.startTime.setTime(Context.startTime.getTime() - 1000 * 60 * 60);
      // Fake a re-start.
      db = new EventsDatabase(Glean.platform.Storage);
      await db.initialize();
    }

    const snapshot = await db.getPingEvents("store", true, new Date());
    assert.ok(snapshot);

    // First event snapshot is always 0.
    const [ firstEvent, ...subsequentEvents ] = snapshot;
    assert.strictEqual(RecordedEvent.fromJSONObject(firstEvent as JSONObject).timestamp, 0);

    // Make sure subsequent timestamps are strictly increasing.
    let prevTime = 0;
    for (const event of subsequentEvents) {
      const e = RecordedEvent.fromJSONObject(event as JSONObject);
      assert.ok(e.timestamp > prevTime);
      prevTime = e.timestamp;
    }

    // Make sure the found events are the expected events.
    for (let i = 0; i < 10; i++) {
      assert.strictEqual("test", (snapshot[i * 2] as JSONObject)["category"]);
      assert.strictEqual(`time_travel_${i}`, (snapshot[i * 2] as JSONObject)["name"]);
      assert.strictEqual("glean", (snapshot[(i * 2) + 1] as JSONObject)["category"]);
      assert.strictEqual("restarted", (snapshot[(i * 2) + 1] as JSONObject)["name"]);
    }
  });
});
