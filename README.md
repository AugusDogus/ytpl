# @augusdogus/ytpl

[![CI](https://github.com/augusdogus/ytpl/actions/workflows/ci.yml/badge.svg)](https://github.com/augusdogus/ytpl/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@augusdogus/ytpl.svg)](https://www.npmjs.com/package/@augusdogus/ytpl) [![License](https://img.shields.io/npm/l/@augusdogus/ytpl.svg)](https://github.com/augusdogus/ytpl/blob/main/LICENSE) [![Bun](https://img.shields.io/badge/Bun-1.3+-black?logo=bun)](https://bun.sh)

A modern TypeScript library for anonymous YouTube playlist resolution.

## Features

- Fetch YouTube playlist information without authentication
- Support for playlists, albums, and channel uploads
- Modern TypeScript with runtime validation using Zod
- Built with Bun for high performance
- Zero dependencies (except Zod for type safety)

## Installation

```bash
bun add @augusdogus/ytpl
```

or

```bash
npm install @augusdogus/ytpl
```

## Usage

### Basic Example

```typescript
import ytpl from '@augusdogus/ytpl'

// Fetch a playlist
const playlist = await ytpl('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', { limit: 10 })

console.log('Title:', playlist.title)
console.log('Total items:', playlist.total_items)
console.log('Views:', playlist.views)

if (playlist.items[0]) {
  const video = playlist.items[0]
  console.log('ID:', video.id)
  console.log('Title:', video.title)
  console.log('URL:', video.url)
  console.log('Author:', video.author.name)
  console.log('Duration:', video.duration)
  console.log('Live:', video.isLive)
}
```

### Fetch Channel Uploads

```typescript
// Using channel ID (automatically converts to uploads playlist)
const playlist = await ytpl('UCuAXFkgsw1L7xaCfnd5JJOw', { limit: 5 })

// Or using channel URL
const playlist2 = await ytpl('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw')

playlist.items.forEach(video => {
  console.log(video.title)
  console.log(video.author.name)
})
```

### Validate and Extract IDs

```typescript
// Validate a playlist ID or URL
if (ytpl.validateID('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')) {
  console.log('Valid playlist ID')
}

// Extract playlist ID from URL
const id = await ytpl.getPlaylistID('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
console.log(id) // PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
```

### Options

- `limit` (number): Maximum number of items to return (default: 100)
- `hl` (string): Language code for localization (default: 'en')
- `gl` (string): Country code for localization (default: 'US')
- `utcOffsetMinutes` (number): UTC offset for localization
- `requestOptions` (RequestInit): Additional fetch options

## Troubleshooting

### Connection Pooling Issues (Bun)

If you're experiencing timeouts or connection issues when using this library with Bun, you may be hitting YouTube's bot detection due to connection pooling. Set the following environment variable to disable HTTP keep-alive:

```bash
export YTPL_DISABLE_KEEPALIVE=true
```

Or in your code:

```typescript
process.env.YTPL_DISABLE_KEEPALIVE = 'true'
```

## API

### `ytpl(id: string, options?: PlaylistOptions): Promise<Playlist>`

Fetches a YouTube playlist.

**Parameters:**
- `id` - Playlist ID, playlist URL, channel URL, or user URL
- `options` - Optional configuration object

**Returns:**
```typescript
{
  id: string
  url: string
  title: string
  description: string | null
  thumbnail: {
    url: string | null
    width: number
    height: number
  }
  total_items: number
  views: number
  items: PlaylistItem[]
}
```

**PlaylistItem Object:**
```typescript
{
  id: string
  title: string
  url: string
  shortUrl: string
  thumbnail: string
  author: {
    name: string
    channelID: string
    url: string
  }
  isLive: boolean
  duration: string | null
}
```

### `ytpl.validateID(id: string): boolean`

Validates a playlist ID or URL (synchronous).

### `ytpl.getPlaylistID(id: string): Promise<string>`

Extracts a playlist ID from various input formats (playlist URL, channel URL, user URL, etc.).

## Supported Input Formats

- Playlist ID: `PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`
- Playlist URL: `https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`
- Watch URL with playlist: `https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID`
- Channel ID: `UCuAXFkgsw1L7xaCfnd5JJOw` (returns uploads playlist)
- Channel URL: `https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw`
- User URL: `https://www.youtube.com/user/someuser`
- Custom URL: `https://www.youtube.com/c/somechannel`
- Album playlist: `OLAK5uy_lKgoGvNrGIp8b0dQHSLKFVPkZ5_5zKJjQ`

**Note:** Mixes (playlists starting with `RD`) are not supported.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT

## Acknowledgments

- Forked from [@distube/ytpl](https://www.npmjs.com/package/@distube/ytpl) (originally built for [DisTube](https://distube.js.org))
- Original [ytpl](https://www.npmjs.com/package/ytpl) library by @TimeForANinja
