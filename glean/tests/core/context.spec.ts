/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import assert from "assert";
import sinon from "sinon";

import { Context } from "../../src/core/context";
import Dispatcher from "../../src/core/dispatcher";
import Glean from "../../src/core/glean";
import MetricsDatabase from "../../src/core/metrics/database";
import EventsDatabase from "../../src/core/metrics/events_database";
import PingsDatabase from "../../src/core/pings/database";
import { sanitizeApplicationId } from "../../src/core/utils";

const sandbox = sinon.createSandbox();

describe("Context", function() {
  const testAppId = `gleanjs.test.${this.title}`;

  beforeEach(async function () {
    await Glean.testResetGlean(testAppId);
  });

  it("dispatcher contains the expected value", async function () {
    assert.notStrictEqual(Context.dispatcher, undefined);
    assert.ok(Context.dispatcher instanceof Dispatcher);

    await Glean.testUninitialize();
    // Dispatcher should be available when Glean is uninitialized too.
    assert.notStrictEqual(Context.dispatcher, undefined);
    assert.ok((Context.dispatcher as unknown) instanceof Dispatcher);
  });

  it("uploadEnabled contains the expected value", async function () {
    assert.strictEqual(Context.uploadEnabled, true);

    Glean.setUploadEnabled(false);
    await Context.dispatcher.testBlockOnQueue();
    assert.strictEqual(Context.uploadEnabled, false);
  });

  it("appId contains the expected value", async function () {
    assert.strictEqual(Context.applicationId, sanitizeApplicationId(testAppId));

    await Glean.testResetGlean("new-id");
    assert.strictEqual(Context.applicationId, sanitizeApplicationId("new-id"));
  });

  it("initialized contains the expected value", async function () {
    assert.strictEqual(Context.initialized, true);

    await Glean.testUninitialize();
    assert.strictEqual(Context.initialized, false);
  });

  it("debugOptions contain the expected value", async function () {
    assert.deepStrictEqual(Context.debugOptions, {});

    await Glean.testResetGlean("new-id", true, { debug: { logPings: true }});
    assert.deepStrictEqual(Context.debugOptions, { logPings: true });
  });

  it("databases contain the expected values", async function () {
    assert.notStrictEqual(Context.metricsDatabase, undefined);
    assert.ok(Context.metricsDatabase instanceof MetricsDatabase);

    assert.notStrictEqual(Context.eventsDatabase, undefined);
    assert.ok(Context.eventsDatabase instanceof EventsDatabase);

    assert.notStrictEqual(Context.pingsDatabase, undefined);
    assert.ok(Context.pingsDatabase instanceof PingsDatabase);
  });
});
