/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import assert from "assert";
import sinon from "sinon";

import PingType from "pings";
import CounterMetricType from "metrics/types/counter";
import { Lifetime } from "metrics";
import Glean from "glean";

const sandbox = sinon.createSandbox();

/**
 * Submist a ping in sync mode.
 *
 * @param ping The ping to submit.
 *
 * @returns Whether or not ping submission was attempted.
 */
async function submitSync(ping: PingType): Promise<boolean> {
  let wasSubmitted: boolean;
  await Glean.dispatcher.executeSynchronously(() => {
    wasSubmitted = ping.submit();
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return wasSubmitted!;
}

describe("PingType", function() {
  afterEach(function () {
    sandbox.restore();
  });

  beforeEach(async function() {
    await Glean.testResetGlean("something something");
  });

  it("collects and stores ping on submit", async function () {
    // Disable ping uploading for it not to interfere with this tests.
    sandbox.stub(Glean["pingUploader"], "triggerUpload").callsFake(() => Promise.resolve());

    const ping = new PingType("custom", true, false, []);
    const counter = new CounterMetricType({
      category: "aCategory",
      name: "aCounterMetric",
      sendInPings: ["custom"],
      lifetime: Lifetime.Ping,
      disabled: false
    });
    await counter.add();

    assert.ok(await submitSync(ping));
    // TODO: Make this nicer once we have a nice way to check if pings are enqueued,
    // possibly once Bug 1677440 is resolved.
    const storedPings = await Glean.pingsDatabase["store"]._getWholeStore();
    assert.strictEqual(Object.keys(storedPings).length, 1);
  });

  it("empty pings with send if emtpy flag are submitted", async function () {
    // Disable ping uploading for it not to interfere with this tests.
    sandbox.stub(Glean["pingUploader"], "triggerUpload").callsFake(() => Promise.resolve());

    const ping1 = new PingType("ping1", true, false, []);
    const ping2 = new PingType("ping2", true, true, []);

    // TODO: Make this nicer once we have a nice way to check if pings are enqueued,
    // possibly once Bug 1677440 is resolved.
    assert.ok(await submitSync(ping1));
    let storedPings = await Glean.pingsDatabase["store"]._getWholeStore();
    assert.strictEqual(Object.keys(storedPings).length, 0);

    assert.ok(await submitSync(ping2));
    storedPings = await Glean.pingsDatabase["store"]._getWholeStore();
    assert.strictEqual(Object.keys(storedPings).length, 1);
  });

  it("no pings are submitted if upload is disabled", async function() {
    await Glean.setUploadEnabled(false);

    const ping = new PingType("custom", true, false, []);
    assert.strictEqual(await submitSync(ping), false);
    // TODO: Make this nicer once we have a nice way to check if pings are enqueued,
    // possibly once Bug 1677440 is resolved.
    const storedPings = await Glean.pingsDatabase["store"]._getWholeStore();
    assert.strictEqual(Object.keys(storedPings).length, 0);
  });

  it("no pings are submitted if Glean has not been initialized", async function() {
    await Glean.testUninitialize();

    const ping = new PingType("custom", true, false, []);
    assert.strictEqual(await submitSync(ping), false);
    // TODO: Make this nicer once we have a nice way to check if pings are enqueued,
    // possibly once Bug 1677440 is resolved.
    const storedPings = await Glean.pingsDatabase["store"]._getWholeStore();
    assert.strictEqual(Object.keys(storedPings).length, 0);
  });
});
