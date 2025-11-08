import {
	type Playlist,
	type PlaylistItem,
	PlaylistSchema,
	parseItem,
} from './parseItem'
import {
	checkArgs,
	doPost,
	type NormalizedOptions,
	type ParsedBody,
	parseBody,
	parseIntegerFromText,
	parseText,
} from './utils'

const BASE_PLIST_URL = 'https://www.youtube.com/playlist?'
const BASE_API_URL = 'https://www.youtube.com/youtubei/v1/browse?key='

export interface PlaylistOptions {
	limit?: number
	gl?: string
	hl?: string
	utcOffsetMinutes?: number
	requestOptions?: RequestInit
}

export { PlaylistSchema }
export type { Playlist, PlaylistItem }

// Helper function to extract continuation token
function getContinuationToken(item: Record<string, unknown>): string | null {
	if (!item || !item.continuationItemRenderer) return null

	try {
		const renderer = item.continuationItemRenderer as Record<string, unknown>

		// Try the standard path first
		if (
			renderer.continuationEndpoint &&
			typeof renderer.continuationEndpoint === 'object' &&
			renderer.continuationEndpoint !== null
		) {
			const endpoint = renderer.continuationEndpoint as Record<string, unknown>
			if (
				endpoint.continuationCommand &&
				typeof endpoint.continuationCommand === 'object' &&
				endpoint.continuationCommand !== null
			) {
				const command = endpoint.continuationCommand as Record<string, unknown>
				if (typeof command.token === 'string') {
					return command.token
				}
			}
		}

		return null
	} catch (_e) {
		return null
	}
}

async function parsePage2(
	apiKey: string,
	token: string,
	context: ParsedBody['context'],
	opts: NormalizedOptions,
): Promise<PlaylistItem[]> {
	const headers = new Headers(opts.requestOptions?.headers)
	headers.set('Content-Type', 'application/json')

	const json = await doPost(
		BASE_API_URL + apiKey,
		{
			...opts.requestOptions,
			method: 'POST',
			headers,
		},
		{ context, continuation: token },
	)

	if (
		!json ||
		typeof json !== 'object' ||
		!('onResponseReceivedActions' in json)
	) {
		return []
	}

	const jsonObj = json as Record<string, unknown>
	const actions = jsonObj.onResponseReceivedActions

	if (!Array.isArray(actions) || actions.length === 0) {
		return []
	}

	const action = actions[0] as Record<string, unknown>
	if (
		!action.appendContinuationItemsAction ||
		typeof action.appendContinuationItemsAction !== 'object'
	) {
		return []
	}

	const appendAction = action.appendContinuationItemsAction as Record<
		string,
		unknown
	>
	const wrapper = appendAction.continuationItems

	if (!Array.isArray(wrapper)) {
		return []
	}

	// Parse items
	const parsedItems = wrapper
		.map((item) => parseItem(item as Record<string, unknown>))
		.filter((a): a is PlaylistItem => a !== null)
		.filter((_, index) => index < opts.limit)

	// Adjust tracker
	opts.limit -= parsedItems.length

	// Parse the continuation
	const continuation = wrapper.find(
		(x) =>
			typeof x === 'object' &&
			x !== null &&
			Object.keys(x)[0] === 'continuationItemRenderer',
	)
	let nextToken: string | null = null
	if (continuation) {
		nextToken = getContinuationToken(continuation as Record<string, unknown>)
	}

	// We're already on last page or hit the limit
	if (!nextToken || opts.limit < 1) return parsedItems

	// Recursively fetch more items
	const nestedResp = await parsePage2(apiKey, nextToken, context, opts)
	parsedItems.push(...nestedResp)
	return parsedItems
}

interface YtplFunction {
	(
		linkOrId: string,
		options?: PlaylistOptions,
		retries?: number,
	): Promise<Playlist>
	validateID: (linkOrId: string) => boolean
	getPlaylistID: (linkOrId: string) => Promise<string>
}

export async function ytpl(
	linkOrId: string,
	options: PlaylistOptions = {},
	retries = 3,
): Promise<Playlist> {
	// Set default values
	const plistId = await (ytpl as YtplFunction).getPlaylistID(linkOrId)
	const opts = checkArgs(plistId, options)

	const url = new URL(BASE_PLIST_URL)
	for (const [key, value] of Object.entries(opts.query)) {
		url.searchParams.set(key, value)
	}

	// Disable keepalive if YTPL_DISABLE_KEEPALIVE is set to avoid connection pooling issues
	const fetchOpts: RequestInit = opts.requestOptions || {}
	if (process.env.YTPL_DISABLE_KEEPALIVE === 'true') {
		fetchOpts.keepalive = false
	}

	const res = await fetch(url.toString(), fetchOpts)
	const body = await res.text()
	const parsed = parseBody(body, opts)

	if (!parsed.json) {
		try {
			let browseId = between(body, '"key":"browse_id","value":"', '"')
			if (!browseId) browseId = `VL${plistId}`
			if (!parsed.apiKey || !parsed.context?.client.clientVersion) {
				throw new Error('Missing api key')
			}
			const headers = new Headers(opts.requestOptions?.headers)
			headers.set('Content-Type', 'application/json')
			parsed.json = await doPost(
				BASE_API_URL + parsed.apiKey,
				{
					...opts.requestOptions,
					method: 'POST',
					headers,
				},
				{ context: parsed.context, browseId },
			)
		} catch (_e) {
			// Unknown
		}
	}

	// Retry if unable to find json
	if (!parsed.json) {
		if (retries === 0) {
			throw new Error('Unsupported playlist')
		}
		return ytpl(linkOrId, options, retries - 1)
	}

	const jsonObj = parsed.json as Record<string, unknown>

	// YouTube might just load the main page and set statuscode 204
	if (!jsonObj.sidebar) throw new Error('Unknown Playlist')

	// Parse alerts
	if (jsonObj.alerts && !jsonObj.contents) {
		// Parse error
		const alerts = jsonObj.alerts as Array<Record<string, unknown>>
		const error = alerts.find(
			(a) =>
				a.alertRenderer &&
				typeof a.alertRenderer === 'object' &&
				(a.alertRenderer as Record<string, unknown>).type === 'ERROR',
		)
		if (error) {
			const alertRenderer = error.alertRenderer as Record<string, unknown>
			throw new Error(parseText(alertRenderer.text))
		}
	}

	try {
		const sidebar = jsonObj.sidebar as Record<string, unknown>
		const sidebarRenderer = sidebar.playlistSidebarRenderer as Record<
			string,
			unknown
		>
		const items = sidebarRenderer.items as Array<Record<string, unknown>>

		const info = items.find(
			(x) => Object.keys(x)[0] === 'playlistSidebarPrimaryInfoRenderer',
		)?.playlistSidebarPrimaryInfoRenderer as Record<string, unknown>

		const thumbnailRenderer = info.thumbnailRenderer as Record<string, unknown>
		const thumbnailData =
			(thumbnailRenderer.playlistVideoThumbnailRenderer as Record<
				string,
				unknown
			>) ||
			(thumbnailRenderer.playlistCustomThumbnailRenderer as Record<
				string,
				unknown
			>)
		const thumbnailObj = thumbnailData.thumbnail as Record<string, unknown>
		const thumbnails = thumbnailObj.thumbnails as Array<Record<string, unknown>>
		const thumbnail = thumbnails.sort(
			(a, b) => (b.width as number) - (a.width as number),
		)[0] as { url: string; width: number; height: number }

		const stats = info.stats as Array<unknown>

		const resp: Playlist = {
			id: plistId,
			thumbnail: {
				url: thumbnail.url,
				width: thumbnail.width,
				height: thumbnail.height,
			},
			url: `${BASE_PLIST_URL}list=${plistId}`,
			title: parseText(info.title),
			description: parseText(info.description),
			total_items: parseIntegerFromText(stats[0]),
			views: stats.length === 3 ? parseIntegerFromText(stats[1]) : 0,
			items: [],
		}

		// Parse videos
		const contents = jsonObj.contents as Record<string, unknown>
		const twoColumnBrowseResultsRenderer =
			contents.twoColumnBrowseResultsRenderer as Record<string, unknown>
		const tabs = twoColumnBrowseResultsRenderer.tabs as Array<
			Record<string, unknown>
		>
		const tabRenderer = tabs[0]?.tabRenderer as Record<string, unknown>
		const content = tabRenderer.content as Record<string, unknown>
		const sectionListRenderer = content.sectionListRenderer as Record<
			string,
			unknown
		>
		const sectionContents = sectionListRenderer.contents as Array<
			Record<string, unknown>
		>

		const itemSectionRenderer = sectionContents.find(
			(x) => Object.keys(x)[0] === 'itemSectionRenderer',
		)
		if (!itemSectionRenderer) throw Error('Empty playlist')

		const itemSection = itemSectionRenderer.itemSectionRenderer as Record<
			string,
			unknown
		>
		const itemSectionContents = itemSection.contents as Array<
			Record<string, unknown>
		>

		const playlistVideoListRenderer = itemSectionContents.find(
			(x) => Object.keys(x)[0] === 'playlistVideoListRenderer',
		)
		if (!playlistVideoListRenderer) throw Error('Empty playlist')

		const playlistVideoList =
			playlistVideoListRenderer.playlistVideoListRenderer as Record<
				string,
				unknown
			>
		const rawVideoList = playlistVideoList.contents as Array<
			Record<string, unknown>
		>

		resp.items = rawVideoList
			.map(parseItem)
			.filter((a): a is PlaylistItem => a !== null)
			.filter((_, index) => index < opts.limit)

		// Adjust tracker
		opts.limit -= resp.items.length

		// Parse the continuation
		const continuation = rawVideoList.find(
			(x) => Object.keys(x)[0] === 'continuationItemRenderer',
		)
		let token: string | null = null
		if (continuation) {
			token = getContinuationToken(continuation)
		}

		// We're already on last page or hit the limit
		if (!token || opts.limit < 1) return resp

		// Recursively fetch more items
		if (!parsed.apiKey) throw new Error('Missing API key for pagination')
		const nestedResp = await parsePage2(
			parsed.apiKey,
			token,
			parsed.context,
			opts,
		)

		// Merge the responses
		resp.items.push(...nestedResp)
		return resp
	} catch (e) {
		if (retries === 0) {
			throw new Error(e instanceof Error ? e.message : String(e))
		}
		return ytpl(linkOrId, options, retries - 1)
	}
}

// Validation and ID extraction
const PLAYLIST_REGEX = /^(FL|PL|UU|LL|RD)[a-zA-Z0-9-_]{16,41}$/
const ALBUM_REGEX = /^OLAK5uy_[a-zA-Z0-9-_]{33}$/
const CHANNEL_REGEX = /^UC[a-zA-Z0-9-_]{22,32}$/
const YT_HOSTS = ['www.youtube.com', 'youtube.com', 'music.youtube.com']

;(ytpl as YtplFunction).validateID = (linkOrId: string): boolean => {
	// Validate inputs
	if (typeof linkOrId !== 'string' || !linkOrId) {
		return false
	}
	// Clean id provided
	if (PLAYLIST_REGEX.test(linkOrId) || ALBUM_REGEX.test(linkOrId)) {
		return true
	}
	if (CHANNEL_REGEX.test(linkOrId)) {
		return true
	}
	// Playlist link provided
	try {
		const parsed = new URL(linkOrId, BASE_PLIST_URL)
		if (!YT_HOSTS.includes(parsed.host)) return false
		if (parsed.searchParams.has('list')) {
			const listParam = parsed.searchParams.get('list')
			if (
				listParam &&
				(PLAYLIST_REGEX.test(listParam) || ALBUM_REGEX.test(listParam))
			) {
				return true
			}
			// Mixes currently not supported
			if (listParam?.startsWith('RD')) {
				return false
			}
			return false
		}
		// Shortened channel or user page provided
		const p = parsed.pathname.slice(1).split('/')
		if (p.length < 2 || p.some((a) => !a)) return false
		const maybeType = p[p.length - 2]
		const maybeId = p[p.length - 1]
		if (maybeType === 'channel') {
			if (maybeId && CHANNEL_REGEX.test(maybeId)) {
				return true
			}
		} else if (maybeType === 'user') {
			return true
		} else if (maybeType === 'c') {
			return true
		}
		return false
	} catch {
		return false
	}
}

;(ytpl as YtplFunction).getPlaylistID = async (
	linkOrId: string,
): Promise<string> => {
	// Validate inputs
	if (typeof linkOrId !== 'string' || !linkOrId) {
		throw new Error('The linkOrId has to be a string')
	}
	// Clean id provided
	if (PLAYLIST_REGEX.test(linkOrId) || ALBUM_REGEX.test(linkOrId)) {
		return linkOrId
	}
	if (CHANNEL_REGEX.test(linkOrId)) {
		return `UU${linkOrId.slice(2)}`
	}
	// Playlist link provided
	try {
		const parsed = new URL(linkOrId, BASE_PLIST_URL)
		if (!YT_HOSTS.includes(parsed.host)) {
			throw new Error('not a known youtube link')
		}
		if (parsed.searchParams.has('list')) {
			const listParam = parsed.searchParams.get('list')
			if (
				listParam &&
				(PLAYLIST_REGEX.test(listParam) || ALBUM_REGEX.test(listParam))
			) {
				return listParam
			}
			// Mixes currently not supported
			if (listParam?.startsWith('RD')) {
				throw new Error('Mixes not supported')
			}
			// Default case
			throw new Error('invalid or unknown list query in url')
		}
		// Shortened channel or user page provided
		const p = parsed.pathname.slice(1).split('/')
		if (p.length < 2 || p.some((a) => !a)) {
			throw new Error(`Unable to find a id in "${linkOrId}"`)
		}
		const maybeType = p[p.length - 2]
		const maybeId = p[p.length - 1]
		if (maybeType === 'channel') {
			if (maybeId && CHANNEL_REGEX.test(maybeId)) {
				return `UU${maybeId.slice(2)}`
			}
		} else if (maybeType === 'user') {
			return await toChannelList(`https://www.youtube.com/user/${maybeId}`)
		} else if (maybeType === 'c') {
			return await toChannelList(`https://www.youtube.com/c/${maybeId}`)
		}
		throw new Error(`Unable to find a id in "${linkOrId}"`)
	} catch (e) {
		if (e instanceof Error) throw e
		throw new Error(String(e))
	}
}

// Gets the channel uploads id of a user (needed for uploads playlist)
const CHANNEL_ONPAGE_REGEXP = /channel_id=UC([\w-]{22,32})"/
async function toChannelList(ref: string): Promise<string> {
	const res = await fetch(ref)
	const body = await res.text()
	const channelMatch = body.match(CHANNEL_ONPAGE_REGEXP)
	if (channelMatch) return `UU${channelMatch[1]}`
	throw new Error(`unable to resolve the ref: ${ref}`)
}

function between(haystack: string, left: string, right: string): string {
	let pos: number
	pos = haystack.indexOf(left)
	if (pos === -1) {
		return ''
	}
	pos += left.length
	haystack = haystack.slice(pos)
	pos = haystack.indexOf(right)
	if (pos === -1) {
		return ''
	}
	haystack = haystack.slice(0, pos)
	return haystack
}

export default ytpl as YtplFunction
