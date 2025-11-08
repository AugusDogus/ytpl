// src/parseItem.ts
// src/utils.ts
import { z, z as z2 } from 'zod'

var DEFAULT_OPTIONS = { limit: 100 }
var DEFAULT_QUERY = { gl: 'US', hl: 'en' }
var DEFAULT_CONTEXT = {
	client: {
		utcOffsetMinutes: -300,
		gl: 'US',
		hl: 'en',
		clientName: 'WEB',
		clientVersion: '<important information>',
	},
	user: {},
	request: {},
}
var CONSENT_COOKIE = 'SOCS=CAI'
var YouTubeTextSchema = z.union([
	z.object({
		simpleText: z.string(),
	}),
	z.object({
		runs: z.array(
			z.object({
				text: z.string(),
			}),
		),
	}),
])
var ParsedBodySchema = z.object({
	json: z.unknown().optional(),
	apiKey: z.string().optional(),
	context: z
		.object({
			client: z.object({
				clientVersion: z.string(),
				utcOffsetMinutes: z.number(),
				gl: z.string(),
				hl: z.string(),
				clientName: z.string(),
			}),
			user: z.record(z.never()),
			request: z.record(z.never()),
		})
		.optional(),
})
var NormalizedOptionsSchema = z.object({
	limit: z.number(),
	requestOptions: z.custom().optional(),
	query: z.record(z.string()),
	gl: z.string().optional(),
	hl: z.string().optional(),
	utcOffsetMinutes: z.number().optional(),
})
function tryParseBetween(body, left, right, addEndCurly = false) {
	try {
		let data = between(body, left, right)
		if (!data) return null
		if (addEndCurly) data += '}'
		return JSON.parse(data)
	} catch (_e) {
		return null
	}
}
function parseBody(body, options = {}) {
	const json =
		tryParseBetween(body, 'var ytInitialData = ', '};', true) ||
		tryParseBetween(body, 'window["ytInitialData"] = ', '};', true) ||
		tryParseBetween(body, 'var ytInitialData = ', ';</script>') ||
		tryParseBetween(body, 'window["ytInitialData"] = ', ';</script>')
	const apiKey =
		between(body, 'INNERTUBE_API_KEY":"', '"') ||
		between(body, 'innertubeApiKey":"', '"')
	const clientVersion =
		between(body, 'INNERTUBE_CONTEXT_CLIENT_VERSION":"', '"') ||
		between(body, 'innertube_context_client_version":"', '"')
	const context = buildPostContext(clientVersion || '', options)
	return ParsedBodySchema.parse({ json, apiKey, context })
}
function buildPostContext(clientVersion, options = {}) {
	const context = structuredClone(DEFAULT_CONTEXT)
	context.client.clientVersion = clientVersion || ''
	if (options.gl) context.client.gl = options.gl
	if (options.hl) context.client.hl = options.hl
	if (options.utcOffsetMinutes)
		context.client.utcOffsetMinutes = options.utcOffsetMinutes
	return context
}
function parseText(txt) {
	const parsed = YouTubeTextSchema.safeParse(txt)
	if (!parsed.success) return ''
	if ('simpleText' in parsed.data) {
		return parsed.data.simpleText
	}
	return parsed.data.runs.map((a) => a.text).join('')
}
function parseIntegerFromText(x) {
	return typeof x === 'string'
		? Number(x)
		: Number(parseText(x).replace(/\D+/g, ''))
}
async function doPost(url, opts, payload) {
	const reqOpts = {
		...opts,
		method: 'POST',
		body: JSON.stringify(payload),
	}
	const r = await fetch(url, reqOpts)
	return r.json()
}
function checkArgs(plistId, options = {}) {
	if (!plistId) {
		throw new Error('playlist ID is mandatory')
	}
	if (typeof plistId !== 'string') {
		throw new Error('playlist ID must be of type string')
	}
	const obj = { ...DEFAULT_OPTIONS, ...options }
	if (Number.isNaN(Number(obj.limit)) || Number(obj.limit) <= 0) {
		obj.limit = DEFAULT_OPTIONS.limit
	}
	const query = { ...DEFAULT_QUERY, list: plistId }
	if (options.gl && typeof options.gl === 'string') {
		query.gl = options.gl
	}
	if (options.hl && typeof options.hl === 'string') {
		query.hl = options.hl
	}
	const requestOptionsValue = options.requestOptions || {}
	const headers = new Headers(requestOptionsValue.headers)
	if (!headers.get('user-agent')) {
		headers.set(
			'user-agent',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36',
		)
	}
	const cookie = headers.get('cookie')
	if (!cookie) {
		headers.set('cookie', CONSENT_COOKIE)
	} else if (!cookie.includes('SOCS=')) {
		headers.set('cookie', `${cookie}; ${CONSENT_COOKIE}`)
	}
	obj.requestOptions = { ...requestOptionsValue, headers }
	const gl = typeof options.gl === 'string' ? options.gl : undefined
	const hl = typeof options.hl === 'string' ? options.hl : undefined
	const utcOffsetMinutes =
		typeof options.utcOffsetMinutes === 'number'
			? options.utcOffsetMinutes
			: undefined
	return NormalizedOptionsSchema.parse({
		...obj,
		query,
		gl,
		hl,
		utcOffsetMinutes,
	})
}
function between(haystack, left, right) {
	let pos
	if (left instanceof RegExp) {
		const match = haystack.match(left)
		if (!match || match.index === undefined) {
			return ''
		}
		pos = match.index + match[0].length
	} else {
		pos = haystack.indexOf(left)
		if (pos === -1) {
			return ''
		}
		pos += left.length
	}
	haystack = haystack.slice(pos)
	pos = haystack.indexOf(right)
	if (pos === -1) {
		return ''
	}
	haystack = haystack.slice(0, pos)
	return haystack
}

// src/parseItem.ts
var BASE_VIDEO_URL = 'https://www.youtube.com/watch?v='
var ImageSchema = z2.object({
	url: z2.string().nullable(),
	width: z2.number(),
	height: z2.number(),
})
var AuthorSchema = z2.object({
	name: z2.string(),
	channelID: z2.string(),
	url: z2.string(),
})
var PlaylistItemSchema = z2.object({
	id: z2.string(),
	title: z2.string(),
	url: z2.string(),
	shortUrl: z2.string(),
	thumbnail: z2.string(),
	author: AuthorSchema,
	isLive: z2.boolean(),
	duration: z2.string().nullable(),
})
var PlaylistSchema = z2.object({
	id: z2.string(),
	url: z2.string(),
	title: z2.string(),
	description: z2.string().nullable(),
	thumbnail: ImageSchema,
	total_items: z2.number(),
	views: z2.number(),
	items: z2.array(z2.custom()),
})
var YouTubeNavigationEndpointSchema = z2.object({
	browseEndpoint: z2.object({
		browseId: z2.string(),
	}),
	commandMetadata: z2.object({
		webCommandMetadata: z2.object({
			url: z2.string(),
		}),
	}),
})
var YouTubeTextSchema2 = z2.union([
	z2.object({
		simpleText: z2.string(),
	}),
	z2.object({
		runs: z2.array(
			z2.object({
				text: z2.string(),
			}),
		),
	}),
])
var YouTubeThumbnailOverlaySchema = z2
	.object({
		thumbnailOverlayTimeStatusRenderer: z2
			.object({
				style: z2.string().optional(),
			})
			.optional(),
	})
	.passthrough()
var YouTubePlaylistVideoRendererSchema = z2
	.object({
		videoId: z2.string(),
		title: YouTubeTextSchema2.optional(),
		shortBylineText: z2
			.object({
				runs: z2.array(
					z2.object({
						text: z2.string(),
						navigationEndpoint: YouTubeNavigationEndpointSchema,
					}),
				),
			})
			.optional(),
		thumbnail: z2.object({
			thumbnails: z2.array(
				z2.object({
					url: z2.string(),
					width: z2.number(),
					height: z2.number(),
				}),
			),
		}),
		thumbnailOverlays: z2.array(YouTubeThumbnailOverlaySchema).optional(),
		lengthText: YouTubeTextSchema2.optional(),
		navigationEndpoint: z2.object({
			commandMetadata: z2.object({
				webCommandMetadata: z2.object({
					url: z2.string(),
				}),
			}),
		}),
		isPlayable: z2.boolean().optional(),
		upcomingEventData: z2.unknown().optional(),
	})
	.passthrough()
var YouTubeItemSchema = z2.object({
	playlistVideoRenderer: YouTubePlaylistVideoRendererSchema,
})
function parseItem(item) {
	const type = Object.keys(item)[0]
	if (type !== 'playlistVideoRenderer') return null
	const parsed = YouTubeItemSchema.safeParse(item)
	if (!parsed.success) {
		return null
	}
	return parsePlaylistVideo(parsed.data.playlistVideoRenderer)
}
function parsePlaylistVideo(info) {
	if (
		!info ||
		!info.shortBylineText ||
		info.upcomingEventData ||
		info.isPlayable === false
	) {
		return null
	}
	const isLive =
		info.thumbnailOverlays?.some(
			(a) =>
				a.thumbnailOverlayTimeStatusRenderer &&
				a.thumbnailOverlayTimeStatusRenderer.style === 'LIVE',
		) || false
	const author = info.shortBylineText.runs[0]
	if (!author) return null
	const result = {
		title: parseText(info.title),
		id: info.videoId,
		shortUrl: BASE_VIDEO_URL + info.videoId,
		url: new URL(
			info.navigationEndpoint.commandMetadata.webCommandMetadata.url,
			BASE_VIDEO_URL,
		).toString(),
		author: {
			url: new URL(
				author.navigationEndpoint.commandMetadata.webCommandMetadata.url,
				BASE_VIDEO_URL,
			).toString(),
			channelID: author.navigationEndpoint.browseEndpoint.browseId,
			name: author.text,
		},
		thumbnail:
			info.thumbnail.thumbnails.sort((a, b) => b.width - a.width)[0]?.url || '',
		isLive,
		duration: info.lengthText ? parseText(info.lengthText) : null,
	}
	try {
		return PlaylistItemSchema.parse(result)
	} catch {
		return null
	}
}

// src/index.ts
var BASE_PLIST_URL = 'https://www.youtube.com/playlist?'
var BASE_API_URL = 'https://www.youtube.com/youtubei/v1/browse?key='
function getContinuationToken(item) {
	if (!item || !item.continuationItemRenderer) return null
	try {
		const renderer = item.continuationItemRenderer
		if (
			renderer.continuationEndpoint &&
			typeof renderer.continuationEndpoint === 'object' &&
			renderer.continuationEndpoint !== null
		) {
			const endpoint = renderer.continuationEndpoint
			if (
				endpoint.continuationCommand &&
				typeof endpoint.continuationCommand === 'object' &&
				endpoint.continuationCommand !== null
			) {
				const command = endpoint.continuationCommand
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
async function parsePage2(apiKey, token, context, opts) {
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
	const jsonObj = json
	const actions = jsonObj.onResponseReceivedActions
	if (!Array.isArray(actions) || actions.length === 0) {
		return []
	}
	const action = actions[0]
	if (
		!action.appendContinuationItemsAction ||
		typeof action.appendContinuationItemsAction !== 'object'
	) {
		return []
	}
	const appendAction = action.appendContinuationItemsAction
	const wrapper = appendAction.continuationItems
	if (!Array.isArray(wrapper)) {
		return []
	}
	const parsedItems = wrapper
		.map((item) => parseItem(item))
		.filter((a) => a !== null)
		.filter((_, index) => index < opts.limit)
	opts.limit -= parsedItems.length
	const continuation = wrapper.find(
		(x) =>
			typeof x === 'object' &&
			x !== null &&
			Object.keys(x)[0] === 'continuationItemRenderer',
	)
	let nextToken = null
	if (continuation) {
		nextToken = getContinuationToken(continuation)
	}
	if (!nextToken || opts.limit < 1) return parsedItems
	const nestedResp = await parsePage2(apiKey, nextToken, context, opts)
	parsedItems.push(...nestedResp)
	return parsedItems
}
async function ytpl(linkOrId, options = {}, retries = 3) {
	const plistId = await ytpl.getPlaylistID(linkOrId)
	const opts = checkArgs(plistId, options)
	const url = new URL(BASE_PLIST_URL)
	for (const [key, value] of Object.entries(opts.query)) {
		url.searchParams.set(key, value)
	}
	const fetchOpts = opts.requestOptions || {}
	if (process.env.YTPL_DISABLE_KEEPALIVE === 'true') {
		fetchOpts.keepalive = false
	}
	const res = await fetch(url.toString(), fetchOpts)
	const body = await res.text()
	const parsed = parseBody(body, opts)
	if (!parsed.json) {
		try {
			let browseId = between2(body, '"key":"browse_id","value":"', '"')
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
		} catch (_e) {}
	}
	if (!parsed.json) {
		if (retries === 0) {
			throw new Error('Unsupported playlist')
		}
		return ytpl(linkOrId, options, retries - 1)
	}
	const jsonObj = parsed.json
	if (!jsonObj.sidebar) throw new Error('Unknown Playlist')
	if (jsonObj.alerts && !jsonObj.contents) {
		const alerts = jsonObj.alerts
		const error = alerts.find(
			(a) =>
				a.alertRenderer &&
				typeof a.alertRenderer === 'object' &&
				a.alertRenderer.type === 'ERROR',
		)
		if (error) {
			const alertRenderer = error.alertRenderer
			throw new Error(parseText(alertRenderer.text))
		}
	}
	try {
		const sidebar = jsonObj.sidebar
		const sidebarRenderer = sidebar.playlistSidebarRenderer
		const items = sidebarRenderer.items
		const info = items.find(
			(x) => Object.keys(x)[0] === 'playlistSidebarPrimaryInfoRenderer',
		)?.playlistSidebarPrimaryInfoRenderer
		const thumbnailRenderer = info.thumbnailRenderer
		const thumbnailData =
			thumbnailRenderer.playlistVideoThumbnailRenderer ||
			thumbnailRenderer.playlistCustomThumbnailRenderer
		const thumbnailObj = thumbnailData.thumbnail
		const thumbnails = thumbnailObj.thumbnails
		const thumbnail = thumbnails.sort((a, b) => b.width - a.width)[0]
		const stats = info.stats
		const resp = {
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
		const contents = jsonObj.contents
		const twoColumnBrowseResultsRenderer =
			contents.twoColumnBrowseResultsRenderer
		const tabs = twoColumnBrowseResultsRenderer.tabs
		const tabRenderer = tabs[0]?.tabRenderer
		const content = tabRenderer.content
		const sectionListRenderer = content.sectionListRenderer
		const sectionContents = sectionListRenderer.contents
		const itemSectionRenderer = sectionContents.find(
			(x) => Object.keys(x)[0] === 'itemSectionRenderer',
		)
		if (!itemSectionRenderer) throw Error('Empty playlist')
		const itemSection = itemSectionRenderer.itemSectionRenderer
		const itemSectionContents = itemSection.contents
		const playlistVideoListRenderer = itemSectionContents.find(
			(x) => Object.keys(x)[0] === 'playlistVideoListRenderer',
		)
		if (!playlistVideoListRenderer) throw Error('Empty playlist')
		const playlistVideoList =
			playlistVideoListRenderer.playlistVideoListRenderer
		const rawVideoList = playlistVideoList.contents
		resp.items = rawVideoList
			.map(parseItem)
			.filter((a) => a !== null)
			.filter((_, index) => index < opts.limit)
		opts.limit -= resp.items.length
		const continuation = rawVideoList.find(
			(x) => Object.keys(x)[0] === 'continuationItemRenderer',
		)
		let token = null
		if (continuation) {
			token = getContinuationToken(continuation)
		}
		if (!token || opts.limit < 1) return resp
		if (!parsed.apiKey) throw new Error('Missing API key for pagination')
		const nestedResp = await parsePage2(
			parsed.apiKey,
			token,
			parsed.context,
			opts,
		)
		resp.items.push(...nestedResp)
		return resp
	} catch (e) {
		if (retries === 0) {
			throw new Error(e instanceof Error ? e.message : String(e))
		}
		return ytpl(linkOrId, options, retries - 1)
	}
}
var PLAYLIST_REGEX = /^(FL|PL|UU|LL|RD)[a-zA-Z0-9-_]{16,41}$/
var ALBUM_REGEX = /^OLAK5uy_[a-zA-Z0-9-_]{33}$/
var CHANNEL_REGEX = /^UC[a-zA-Z0-9-_]{22,32}$/
var YT_HOSTS = ['www.youtube.com', 'youtube.com', 'music.youtube.com']
ytpl.validateID = (linkOrId) => {
	if (typeof linkOrId !== 'string' || !linkOrId) {
		return false
	}
	if (PLAYLIST_REGEX.test(linkOrId) || ALBUM_REGEX.test(linkOrId)) {
		return true
	}
	if (CHANNEL_REGEX.test(linkOrId)) {
		return true
	}
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
			if (listParam?.startsWith('RD')) {
				return false
			}
			return false
		}
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
ytpl.getPlaylistID = async (linkOrId) => {
	if (typeof linkOrId !== 'string' || !linkOrId) {
		throw new Error('The linkOrId has to be a string')
	}
	if (PLAYLIST_REGEX.test(linkOrId) || ALBUM_REGEX.test(linkOrId)) {
		return linkOrId
	}
	if (CHANNEL_REGEX.test(linkOrId)) {
		return `UU${linkOrId.slice(2)}`
	}
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
			if (listParam?.startsWith('RD')) {
				throw new Error('Mixes not supported')
			}
			throw new Error('invalid or unknown list query in url')
		}
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
var CHANNEL_ONPAGE_REGEXP = /channel_id=UC([\w-]{22,32})"/
async function toChannelList(ref) {
	const res = await fetch(ref)
	const body = await res.text()
	const channelMatch = body.match(CHANNEL_ONPAGE_REGEXP)
	if (channelMatch) return `UU${channelMatch[1]}`
	throw new Error(`unable to resolve the ref: ${ref}`)
}
function between2(haystack, left, right) {
	let pos
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
var src_default = ytpl
export { ytpl, src_default as default, PlaylistSchema }
