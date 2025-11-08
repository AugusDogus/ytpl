import { z } from 'zod'
declare const PlaylistItemSchema: z.ZodObject<
	{
		id: z.ZodString
		title: z.ZodString
		url: z.ZodString
		shortUrl: z.ZodString
		thumbnail: z.ZodString
		author: z.ZodObject<
			{
				name: z.ZodString
				channelID: z.ZodString
				url: z.ZodString
			},
			'strip',
			z.ZodTypeAny,
			{
				url: string
				name: string
				channelID: string
			},
			{
				url: string
				name: string
				channelID: string
			}
		>
		isLive: z.ZodBoolean
		duration: z.ZodNullable<z.ZodString>
	},
	'strip',
	z.ZodTypeAny,
	{
		url: string
		id: string
		title: string
		shortUrl: string
		thumbnail: string
		author: {
			url: string
			name: string
			channelID: string
		}
		isLive: boolean
		duration: string | null
	},
	{
		url: string
		id: string
		title: string
		shortUrl: string
		thumbnail: string
		author: {
			url: string
			name: string
			channelID: string
		}
		isLive: boolean
		duration: string | null
	}
>
declare const PlaylistSchema: z.ZodObject<
	{
		id: z.ZodString
		url: z.ZodString
		title: z.ZodString
		description: z.ZodNullable<z.ZodString>
		thumbnail: z.ZodObject<
			{
				url: z.ZodNullable<z.ZodString>
				width: z.ZodNumber
				height: z.ZodNumber
			},
			'strip',
			z.ZodTypeAny,
			{
				url: string | null
				width: number
				height: number
			},
			{
				url: string | null
				width: number
				height: number
			}
		>
		total_items: z.ZodNumber
		views: z.ZodNumber
		items: z.ZodArray<
			z.ZodType<
				{
					url: string
					id: string
					title: string
					shortUrl: string
					thumbnail: string
					author: {
						url: string
						name: string
						channelID: string
					}
					isLive: boolean
					duration: string | null
				},
				z.ZodTypeDef,
				{
					url: string
					id: string
					title: string
					shortUrl: string
					thumbnail: string
					author: {
						url: string
						name: string
						channelID: string
					}
					isLive: boolean
					duration: string | null
				}
			>,
			'many'
		>
	},
	'strip',
	z.ZodTypeAny,
	{
		url: string
		id: string
		title: string
		thumbnail: {
			url: string | null
			width: number
			height: number
		}
		description: string | null
		total_items: number
		views: number
		items: {
			url: string
			id: string
			title: string
			shortUrl: string
			thumbnail: string
			author: {
				url: string
				name: string
				channelID: string
			}
			isLive: boolean
			duration: string | null
		}[]
	},
	{
		url: string
		id: string
		title: string
		thumbnail: {
			url: string | null
			width: number
			height: number
		}
		description: string | null
		total_items: number
		views: number
		items: {
			url: string
			id: string
			title: string
			shortUrl: string
			thumbnail: string
			author: {
				url: string
				name: string
				channelID: string
			}
			isLive: boolean
			duration: string | null
		}[]
	}
>
type PlaylistItem = z.infer<typeof PlaylistItemSchema>
type Playlist = z.infer<typeof PlaylistSchema>
interface PlaylistOptions {
	limit?: number
	gl?: string
	hl?: string
	utcOffsetMinutes?: number
	requestOptions?: RequestInit
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
declare function ytpl(
	linkOrId: string,
	options?: PlaylistOptions,
	retries?: number,
): Promise<Playlist>
declare const _default: YtplFunction
export {
	ytpl,
	_default as default,
	PlaylistSchema,
	PlaylistOptions,
	PlaylistItem,
	Playlist,
}
