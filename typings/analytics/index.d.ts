declare module 'analytics' {
	export default class Analytics {
		constructor(options: any)

		track(eventName: string, properties: any)
		identify(userId: string, properties: any)
	}
}

declare module '@analytics/amplitude-node' {
	export default function amplitudePlugin(options: any)
}
