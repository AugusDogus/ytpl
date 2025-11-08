import { expect, test } from 'bun:test'
import ytpl from '../src'

// Disable keepalive for tests to avoid connection pooling issues with YouTube's bot detection
if (!process.env.YTPL_DISABLE_KEEPALIVE) {
	process.env.YTPL_DISABLE_KEEPALIVE = 'true'
}

test('should validate playlist IDs', () => {
	expect(ytpl.validateID('PLRBp0Fe2GpgmsW5VYz6CbJ_l1a8Yv53q3')).toBe(true)
	expect(ytpl.validateID('OLAK5uy_lKgoGvNrGIp8b0dQHSLKFVPkZ5_5zKJjQ')).toBe(
		true,
	)
	expect(ytpl.validateID('UCuAXFkgsw1L7xaCfnd5JJOw')).toBe(true)
	expect(ytpl.validateID('invalid')).toBe(false)
	expect(ytpl.validateID('')).toBe(false)
})

test('should validate playlist URLs', () => {
	expect(
		ytpl.validateID(
			'https://www.youtube.com/playlist?list=PLRBp0Fe2GpgmsW5VYz6CbJ_l1a8Yv53q3',
		),
	).toBe(true)
	expect(
		ytpl.validateID('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw'),
	).toBe(true)
	expect(ytpl.validateID('https://www.youtube.com/user/someuser')).toBe(true)
	expect(ytpl.validateID('https://www.youtube.com/c/somechannel')).toBe(true)
	expect(ytpl.validateID('https://google.com')).toBe(false)
})

test('should reject mixes', () => {
	expect(
		ytpl.validateID(
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ',
		),
	).toBe(false)
})

test('should extract playlist ID from URL', async () => {
	const id = await ytpl.getPlaylistID(
		'https://www.youtube.com/playlist?list=PLRBp0Fe2GpgmsW5VYz6CbJ_l1a8Yv53q3',
	)
	expect(id).toBe('PLRBp0Fe2GpgmsW5VYz6CbJ_l1a8Yv53q3')
})

test('should extract playlist ID from watch URL with list parameter', async () => {
	const id = await ytpl.getPlaylistID(
		'https://www.youtube.com/watch?v=IluRBvnYMoY&list=OLAK5uy_nZZjkBu_E4olFSb5Ey-fQ-4a0ZCqJICdQ&index=1',
	)
	expect(id).toBe('OLAK5uy_nZZjkBu_E4olFSb5Ey-fQ-4a0ZCqJICdQ')
})

test('should extract playlist ID from channel ID', async () => {
	const id = await ytpl.getPlaylistID('UCuAXFkgsw1L7xaCfnd5JJOw')
	expect(id).toBe('UUuAXFkgsw1L7xaCfnd5JJOw')
})

test('should return playlist ID as-is', async () => {
	const id = await ytpl.getPlaylistID('PLRBp0Fe2GpgmsW5VYz6CbJ_l1a8Yv53q3')
	expect(id).toBe('PLRBp0Fe2GpgmsW5VYz6CbJ_l1a8Yv53q3')
})

test('should throw error for invalid input', async () => {
	await expect(ytpl.getPlaylistID('')).rejects.toThrow()
	await expect(ytpl.getPlaylistID('invalid')).rejects.toThrow()
})

test('should fetch a playlist', async () => {
	// Using YouTube's own "YouTube Rewind" playlist which should be stable
	const playlist = await ytpl('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', {
		limit: 5,
	})
	expect(playlist.id).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
	expect(playlist.title).toBeDefined()
	expect(playlist.url).toContain('youtube.com/playlist')
	expect(playlist.items).toBeInstanceOf(Array)
	expect(playlist.items.length).toBeGreaterThan(0)
	expect(playlist.items.length).toBeLessThanOrEqual(5)
	expect(playlist.total_items).toBeGreaterThan(0)
	expect(playlist.thumbnail).toBeDefined()
	expect(playlist.thumbnail.url).toBeDefined()
})

test('should fetch playlist items with correct structure', async () => {
	const playlist = await ytpl('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', {
		limit: 1,
	})
	const item = playlist.items[0]

	expect(item).toBeDefined()
	expect(item.id).toBeDefined()
	expect(item.title).toBeDefined()
	expect(item.url).toContain('youtube.com/watch')
	expect(item.shortUrl).toContain('youtube.com/watch?v=')
	expect(item.thumbnail).toBeDefined()
	expect(typeof item.isLive).toBe('boolean')
	expect(item.author).toBeDefined()
	expect(item.author.name).toBeDefined()
	expect(item.author.channelID).toBeDefined()
	expect(item.author.url).toContain('youtube.com')
})

test('should respect limit option', async () => {
	const playlist = await ytpl('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', {
		limit: 3,
	})
	expect(playlist.items.length).toBeLessThanOrEqual(3)
})

test('should fetch playlist from channel URL', async () => {
	// Using a known channel - this will fetch the uploads playlist
	const playlist = await ytpl(
		'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
		{ limit: 1 },
	)
	expect(playlist.items).toBeInstanceOf(Array)
	expect(playlist.id).toContain('UU')
})

test('should support localization options', async () => {
	const playlist = await ytpl('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', {
		hl: 'es',
		gl: 'MX',
		limit: 1,
	})
	expect(playlist.items.length).toBeGreaterThan(0)
})

test('should handle pagination', async () => {
	const playlist = await ytpl('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', {
		limit: 150,
	})
	// If the playlist has more than 100 items, pagination was used
	if (playlist.total_items > 100) {
		expect(playlist.items.length).toBeGreaterThan(100)
	}
})

test('should throw error for unknown playlist', async () => {
	await expect(ytpl('PLInvalidPlaylistId123456789')).rejects.toThrow()
})

test('should handle album playlists', async () => {
	// Using a known album playlist - Daft Punk's Random Access Memories
	const playlist = await ytpl('OLAK5uy_nZZjkBu_E4olFSb5Ey-fQ-4a0ZCqJICdQ', {
		limit: 5,
	})
	expect(playlist.id).toBe('OLAK5uy_nZZjkBu_E4olFSb5Ey-fQ-4a0ZCqJICdQ')
	expect(playlist.items).toBeInstanceOf(Array)
})
