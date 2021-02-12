/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UploadResult, UploadResultStatus } from "core/upload";
import Uploader from "core/upload/uploader";

class MockUploader extends Uploader {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  post(_url: string, _body: string, _headers?: Record<string, string>): Promise<UploadResult> {
    const result: UploadResult = {
      result: UploadResultStatus.Success,
      status: 200
    };
    return Promise.resolve(result);
  }
}

export default new MockUploader();
