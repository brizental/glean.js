/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Platform from "platform";

import Store from "./store";
import Info from "./platform_info";
import Uploader from "platform/browser_uploader";

const WebExtPlatform: Platform = {
  store: Store,
  info: Info,
  uploader: Uploader,
};

export default WebExtPlatform;
