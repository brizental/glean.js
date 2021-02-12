/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Store from "core/storage";
import PlatformInfo from "core/platform_info";
import Uploader from "core/upload/uploader";

/**
 * Platform specific API implementations.
 */
interface Platform {
  // A persistent storage API.
  store: new (store: string) => Store,
  // An API for retrieving information about the current platform.
  info: PlatformInfo,
  // An API for making HTTP requests.
  uploader: Uploader,
}

export default Platform;
