/**
 * @license
 * Copyright 2019 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import amplitudePlugin from '@analytics/amplitude-node';
import Analytics from 'analytics';
import BalenaSdk = require('balena-sdk');
import Promise = require('bluebird');
import _ = require('lodash');
import Mixpanel = require('mixpanel');
import Raven = require('raven');

import packageJSON = require('../package.json');

const getAnalytics = _.once(() => {
	return new Analytics({
		plugins: [
			amplitudePlugin({
				apiKey: '53d3fefc441f8d7cf553bd89ca27174b', // TODO: set balena-main instead.
				options: {
					// TODO: Set data.balena-cloud.com/amplitude
					errorReporter: console.error
				},
			}),
		],
	});
});

const getBalenaSdk = _.once(() => BalenaSdk.fromSharedOptions());
const getMixpanel = _.once<any>(() => {
	const settings = require('balena-settings-client');
	return Mixpanel.init('balena-main', {
		host: `api.${settings.get('balenaUrl')}`,
		path: '/mixpanel',
		protocol: 'https',
	});
});

export function trackCommand(commandSignature: string) {
	const balena = getBalenaSdk();
	return Promise.props({
		balenaUrl: balena.settings.get('balenaUrl'),
		username: balena.auth.whoami().catchReturn(undefined),
		mixpanel: getMixpanel(),
		analytics: getAnalytics(),
	})
		.then(({ username, balenaUrl, mixpanel, analytics }) => {
			return Promise.try(() => {
				Raven.mergeContext({
					user: {
						id: username,
						username,
					},
				});

				if (username) {
					analytics.identify(username);
					console.log('identify as', username);
				}

				analytics.track(`[CLI] ${commandSignature}`, {
					version: packageJSON.version,
					node: process.version,
					arch: process.arch,
					balenaUrl, // e.g. 'balena-cloud.com' or 'balena-staging.com'
					platform: process.platform,
				});
				console.log('new tracking done');

				// commandSignature is a string like, for example:
				//     "push <applicationOrDevice>"
				// That's literally so: "applicationOrDevice" is NOT replaced with
				// the actual application ID or device ID. The purpose is find out the
				// most / least used command verbs, so we can focus our development
				// effort where it is most beneficial to end users.
				return mixpanel.track(`[CLI] ${commandSignature}`, {
					distinct_id: username,
					version: packageJSON.version,
					node: process.version,
					arch: process.arch,
					balenaUrl, // e.g. 'balena-cloud.com' or 'balena-staging.com'
					platform: process.platform,
				});
			});
		})
		.timeout(100)
		.catchReturn(undefined);
}
