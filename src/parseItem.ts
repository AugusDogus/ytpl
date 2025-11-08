import { z } from 'zod'
import { parseText } from './utils'

const BASE_VIDEO_URL = 'https://www.youtube.com/watch?v='

export const ImageSchema = z.object({
	url: z.string().nullable(),
	width: z.number(),
	height: z.number(),
})

export const AuthorSchema = z.object({
	name: z.string(),
	channelID: z.string(),
	url: z.string(),
})

export const PlaylistItemSchema = z.object({
	id: z.string(),
	title: z.string(),
	url: z.string(),
	shortUrl: z.string(),
	thumbnail: z.string(),
	author: AuthorSchema,
	isLive: z.boolean(),
	duration: z.string().nullable(),
})

export const PlaylistSchema = z.object({
	id: z.string(),
	url: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	thumbnail: ImageSchema,
	total_items: z.number(),
	views: z.number(),
	items: z.array(z.custom<PlaylistItem>()),
})

export type Image = z.infer<typeof ImageSchema>
export type Author = z.infer<typeof AuthorSchema>
export type PlaylistItem = z.infer<typeof PlaylistItemSchema>
export type Playlist = z.infer<typeof PlaylistSchema>

// YouTube API response schemas
const YouTubeNavigationEndpointSchema = z.object({
	browseEndpoint: z.object({
		browseId: z.string(),
	}),
	commandMetadata: z.object({
		webCommandMetadata: z.object({
			url: z.string(),
		}),
	}),
})

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

const YouTubeThumbnailOverlaySchema = z
	.object({
		thumbnailOverlayTimeStatusRenderer: z
			.object({
				style: z.string().optional(),
			})
			.optional(),
	})
	.passthrough()

const YouTubePlaylistVideoRendererSchema = z
	.object({
		videoId: z.string(),
		title: YouTubeTextSchema.optional(),
		shortBylineText: z
			.object({
				runs: z.array(
					z.object({
						text: z.string(),
						navigationEndpoint: YouTubeNavigationEndpointSchema,
					}),
				),
			})
			.optional(),
		thumbnail: z.object({
			thumbnails: z.array(
				z.object({
					url: z.string(),
					width: z.number(),
					height: z.number(),
				}),
			),
		}),
		thumbnailOverlays: z.array(YouTubeThumbnailOverlaySchema).optional(),
		lengthText: YouTubeTextSchema.optional(),
		navigationEndpoint: z.object({
			commandMetadata: z.object({
				webCommandMetadata: z.object({
					url: z.string(),
				}),
			}),
		}),
		isPlayable: z.boolean().optional(),
		upcomingEventData: z.unknown().optional(),
	})
	.passthrough()

const YouTubeItemSchema = z.object({
	playlistVideoRenderer: YouTubePlaylistVideoRendererSchema,
})

type YouTubePlaylistVideoRenderer = z.infer<
	typeof YouTubePlaylistVideoRendererSchema
>

export function parseItem(item: Record<string, unknown>): PlaylistItem | null {
	const type = Object.keys(item)[0]
	if (type !== 'playlistVideoRenderer') return null

	const parsed = YouTubeItemSchema.safeParse(item)
	if (!parsed.success) {
		return null
	}

	return parsePlaylistVideo(parsed.data.playlistVideoRenderer)
}

function parsePlaylistVideo(
	info: YouTubePlaylistVideoRenderer,
): PlaylistItem | null {
	// Skip if not playable, upcoming, or missing author
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
