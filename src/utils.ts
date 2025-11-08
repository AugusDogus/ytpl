import { z } from 'zod'

const DEFAULT_OPTIONS = { limit: 100 }
const DEFAULT_QUERY = { gl: 'US', hl: 'en' }
const DEFAULT_CONTEXT: {
	client: {
		utcOffsetMinutes: number
		gl: string
		hl: string
		clientName: string
		clientVersion: string
	}
	user: Record<string, never>
	request: Record<string, never>
} = {
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
const CONSENT_COOKIE = 'SOCS=CAI'

const YouTubeTextSchema = z.union([
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

export const ParsedBodySchema = z.object({
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

export const NormalizedOptionsSchema = z.object({
	limit: z.number(),
	requestOptions: z.custom<RequestInit>().optional(),
	query: z.record(z.string()),
	gl: z.string().optional(),
	hl: z.string().optional(),
	utcOffsetMinutes: z.number().optional(),
})

export type ParsedBody = z.infer<typeof ParsedBodySchema>
export type NormalizedOptions = z.infer<typeof NormalizedOptionsSchema>

function tryParseBetween(
	body: string,
	left: string,
	right: string,
	addEndCurly = false,
) {
	try {
		let data = between(body, left, right)
		if (!data) return null
		if (addEndCurly) data += '}'
		return JSON.parse(data)
	} catch (_e) {
		return null
	}
}

export function parseBody(
	body: string,
	options: Partial<NormalizedOptions> = {},
): ParsedBody {
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

export function buildPostContext(
	clientVersion: string,
	options: Partial<NormalizedOptions> = {},
): {
	client: {
		utcOffsetMinutes: number
		gl: string
		hl: string
		clientName: string
		clientVersion: string
	}
	user: Record<string, never>
	request: Record<string, never>
} {
	const context = structuredClone(DEFAULT_CONTEXT)
	context.client.clientVersion = clientVersion || ''

	if (options.gl) context.client.gl = options.gl
	if (options.hl) context.client.hl = options.hl
	if (options.utcOffsetMinutes)
		context.client.utcOffsetMinutes = options.utcOffsetMinutes

	return context
}

export function parseText(txt: unknown): string {
	const parsed = YouTubeTextSchema.safeParse(txt)
	if (!parsed.success) return ''

	if ('simpleText' in parsed.data) {
		return parsed.data.simpleText
	}

	return parsed.data.runs.map((a) => a.text).join('')
}

export function parseIntegerFromText(x: unknown): number {
	return typeof x === 'string'
		? Number(x)
		: Number(parseText(x).replace(/\D+/g, ''))
}

export async function doPost(
	url: string,
	opts: RequestInit,
	payload: unknown,
): Promise<unknown> {
	const reqOpts = {
		...opts,
		method: 'POST',
		body: JSON.stringify(payload),
	}
	const r = await fetch(url, reqOpts)
	return r.json()
}

export function checkArgs(
	plistId: string,
	options: {
		limit?: number
		gl?: string
		hl?: string
		utcOffsetMinutes?: number
		requestOptions?: RequestInit
	} = {},
): NormalizedOptions {
	if (!plistId) {
		throw new Error('playlist ID is mandatory')
	}
	if (typeof plistId !== 'string') {
		throw new Error('playlist ID must be of type string')
	}

	const obj: Record<string, unknown> = { ...DEFAULT_OPTIONS, ...options }

	if (Number.isNaN(Number(obj.limit)) || Number(obj.limit) <= 0) {
		obj.limit = DEFAULT_OPTIONS.limit
	}

	const query: Record<string, string> = { ...DEFAULT_QUERY, list: plistId }
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

function between(
	haystack: string,
	left: string | RegExp,
	right: string,
): string {
	let pos: number
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
