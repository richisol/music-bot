import fetch from 'node-fetch';
import fs from 'fs';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const ARTIST_IDS = [
  '699OTQXzgjhIYAHMy9RyPD', // Playboi Carti
  '504cl42JQLRqlZddfZ3S4z', // Cezinando
  '4Gso3d4CscCijv0lmajZWs', // Don Toliver
  '0Y5tJX1MQlPlqiwlOH1tJY', // Travis Scott
  '0GM7qgcRCORpGnfcN2tCiB', // Tainy
  '4q3ewBCX7sLwd24euuV69X', // Bad Bunny
  '3qiHUAX7zY4Qnjx8TNUzVx', // Yeat
  '0EyhkwP3UnwGFBy6xwKjSy', // EsDeeKid
  '4QM5QCHicznALtX885CnZC', // Central Cee
  '1VPmR4DJC1PlOtd0IADAO0', // SuicideBoys
  '4V8LLVI7PbaPR0K2TGSxFF', // Tyler, the Creator
  '13ubrt8QOOCPljQ2FL1Kca', // Asap Rocky
  '7KjsjftPKKarTvZlawniPi', // Marstein
  '35j3Bv3gRKUHbiFSxVjjIf', // Stig Brenner
  '68kEuyFKyqrdQQLLsmiatm', // Vince Staples
  '3zmfs9cQwzJl575W1ZYXeT', // Men I Trust
  '3uwAm6vQy7kWPS2bciKWx9', // girl in red
  '12Chz98pHFMPJEknJQMWvI', // Muse
  '25uiPmTg16RbhZWAqwLBy5', // Charli xcx
];

const RELEASE_TYPES = ['album', 'single', 'compilation'];
const SEEN_FILE = './seen_releases.json';

async function getSpotifyToken() {
  const creds = Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + creds, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  return data.access_token;
}

async function getLatestReleases(token, artistId) {
  const types = RELEASE_TYPES.join(',');
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=${types}&market=GB&limit=5`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json();
  return data.items || [];
}

async function getArtistName(token, artistId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  return data.name || artistId;
}

async function announceAll(newReleases) {
  if (newReleases.length === 0) return;

  const embeds = newReleases.slice(0, 10).map(({ release, artistName }) => {
    const typeLabel = { album: '💿 Album', single: '🎵 Single', compilation: '📀 EP / Compilation' };
    const label = typeLabel[release.album_type] || '🎵 Release';
    const image = release.images?.[0]?.url;

    return {
      title: release.name,
      url: release.external_urls?.spotify,
      description: `New ${label.toLowerCase()} by **${artistName}**`,
      color: 0x1DB954,
      thumbnail: image ? { url: image } : undefined,
      fields: [
        { name: 'Type', value: label, inline: true },
        { name: 'Release date', value: release.release_date, inline: true },
        { name: 'Tracks', value: String(release.total_tracks), inline: true }
      ],
      footer: { text: 'Music Release Bot • Spotify' }
    };
  });

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds })
  });

  console.log(`Announced ${embeds.length} release(s) in one message.`);
}

function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))); }
  catch { return new Set(); }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
}

async function run() {
  console.log(`[${new Date().toISOString()}] Checking for new releases...`);
  const seen = loadSeen();
  const token = await getSpotifyToken();
  const newReleases = [];

  for (const artistId of ARTIST_IDS) {
    const artistName = await getArtistName(token, artistId);
    const releases = await getLatestReleases(token, artistId);

    for (const release of releases) {
      if (!seen.has(release.id)) {
        seen.add(release.id);
        newReleases.push({ release, artistName });
      }
    }
  }

  // Discord allows max 10 embeds per message — batch if needed
  for (let i = 0; i < newReleases.length; i += 10) {
    await announceAll(newReleases.slice(i, i + 10));
    if (i + 10 < newReleases.length) await new Promise(r => setTimeout(r, 1000));
  }

  saveSeen(seen);
  console.log('Done.');
}

run().catch(console.error);
