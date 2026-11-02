"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Play, Pause, Check, Plus, Sparkles, Flame, Headphones } from 'lucide-react';
import { usePlayerStore, Track } from '@/store/playerStore';
import { audioPlayer } from '@/lib/audioPlayer';
import MusicPoster from '@/components/ui/MusicPoster';
import SongCarousel from '@/components/ui/SongCarousel';
import SongCard from '@/components/ui/SongCard';
import { getClientCache, setClientCache } from '@/lib/clientCache';

interface Section {
  title: string;
  subtitle?: string;
  tracks: Track[];
}

const FILTER_CHIPS = [
  "All",
  "Relax",
  "Sleep",
  "Energize",
  "Sad",
  "Romance",
  "Feel Good",
  "Workout",
  "Party",
  "Commute",
  "Focus"
];

// Curated mood configurations mapping each filter chip to targeted categories
const MOOD_CONFIG: Record<string, {
  query1: string;
  title1: string;
  subtitle1: string;
  query2: string;
  title2: string;
  subtitle2: string;
}> = {
  Relax: {
    query1: "chill acoustic relax peaceful songs",
    title1: "Peaceful Acoustic & Chill",
    subtitle1: "RELAX & UNWIND",
    query2: "lofi chill beats relax calm",
    title2: "Lo-Fi Beats & Ambient Calm",
    subtitle2: "MELLOW INSTRUMENTAL"
  },
  Sleep: {
    query1: "deep sleep relaxing music",
    title1: "Deep Sleep & Night Melodies",
    subtitle1: "RESTFUL SLEEP",
    query2: "gentle piano sleep instrumental calm",
    title2: "Soothing Night Piano",
    subtitle2: "CALMING SOUNDS"
  },
  Energize: {
    query1: "high energy upbeat pop dance bangers",
    title1: "High Energy Bangers",
    subtitle1: "INSTANT ENERGY BOOST",
    query2: "electronic dance high energy hits",
    title2: "Electrifying Dance & Pop",
    subtitle2: "ADRENALINE RUSH"
  },
  Sad: {
    query1: "sad heartbreak acoustic songs deep",
    title1: "Heartbreak & Melancholy",
    subtitle1: "DEEP EMOTIONS",
    query2: "emotional slow lyrical ballads acoustic",
    title2: "Soul-Stirring Ballads",
    subtitle2: "RAINY DAY VIBES"
  },
  Romance: {
    query1: "romantic love songs acoustic hits",
    title1: "Sweet Romance & Love Songs",
    subtitle1: "CANDLELIGHT & LOVE",
    query2: "romantic slow jams duets soul",
    title2: "Intimate Slow Jams & Duets",
    subtitle2: "PASSIONATE MELODIES"
  },
  "Feel Good": {
    query1: "feel good happy upbeat pop hits",
    title1: "Feel Good Anthems",
    subtitle1: "100% POSITIVE VIBES",
    query2: "cheerful sunny day classics happy",
    title2: "Sunshine Hits & Cheerful Beats",
    subtitle2: "PURE JOY"
  },
  Workout: {
    query1: "gym workout motivation pump music",
    title1: "Beast Mode Motivation",
    subtitle1: "GYM & FITNESS FUEL",
    query2: "high bpm cardio trap workout hits",
    title2: "High-BPM Cardio & Trap",
    subtitle2: "HEAVY PUMP"
  },
  Party: {
    query1: "party dance hits club bangers 2026",
    title1: "Club Bangers & Dance Hits",
    subtitle1: "SATURDAY NIGHT FEVER",
    query2: "festival edm party remixes bass",
    title2: "Festival Anthems & Bass",
    subtitle2: "CELEBRATION TIME"
  },
  Commute: {
    query1: "road trip sing along driving music songs",
    title1: "Road Trip Sing-Alongs",
    subtitle1: "ON THE ROAD",
    query2: "city cruising night drive chill beats",
    title2: "Late Night City Cruising",
    subtitle2: "HIGHWAY VIBES"
  },
  Focus: {
    query1: "lofi study beats concentration deep focus",
    title1: "Deep Work & Study Flow",
    subtitle1: "FOCUS & PRODUCTIVITY",
    query2: "ambient instrumental concentration focus",
    title2: "Ambient Brainwave Flow",
    subtitle2: "ALPHA WAVES & FLOW"
  }
};

// Fallback trending hits for instant rendering with popular chart-toppers
const FALLBACK_TRENDING_HITS: Track[] = [
  {
    videoId: "J7p4bzqLvCw",
    title: "Blinding Lights",
    artists: [{ name: "The Weeknd" }],
    duration: 200,
    durationFormatted: "3:20",
    poster: "https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/J7p4bzqLvCw/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "DlFXDl_ROAM",
    title: "Die With A Smile",
    artists: [{ name: "Lady Gaga, Bruno Mars" }],
    duration: 251,
    durationFormatted: "4:11",
    poster: "https://yt3.googleusercontent.com/RFK4wHeGqwI3DndbARbRJB21IC0TcmqnrlyjxYK7T-nC8wlIVbfxNaCIFKNvSpchDKmYyVLe1RN36w=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/DlFXDl_ROAM/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "WKZO-CWeOVA",
    title: "Birds of a Feather",
    artists: [{ name: "Billie Eilish" }],
    duration: 198,
    durationFormatted: "3:18",
    poster: "https://yt3.googleusercontent.com/mXJjWX4E6Gpr03CUYl18PdVXlczmoL2Tm-LEBGafIr_8smlHnl8AHniJu0_7Y80e-aeloJxcryQQx0ZJ=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/WKZO-CWeOVA/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "kIft-LUHHVA",
    title: "Espresso",
    artists: [{ name: "Sabrina Carpenter" }],
    duration: 175,
    durationFormatted: "2:55",
    poster: "https://i.ytimg.com/vi/kIft-LUHHVA/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/kIft-LUHHVA/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "OsfAnsMY21M",
    title: "Levitating",
    artists: [{ name: "Dua Lipa" }],
    duration: 203,
    durationFormatted: "3:23",
    poster: "https://yt3.googleusercontent.com/UpJ_IhBqyhQV9b2UGcDxxWDm14kRQ2eY1o9S96AGsbE7Ol8isbpbPA0Yefvg8S8ZGAX9L1g4xaj21zVJ=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/OsfAnsMY21M/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "xTvyyoF_LZY",
    title: "Shape of You",
    artists: [{ name: "Ed Sheeran" }],
    duration: 233,
    durationFormatted: "3:53",
    poster: "https://yt3.googleusercontent.com/TMbA3LImAL96nFkm5cI1x6LiEMvMbRg4IRxEeABd9qpXsfmwKhZHRD1MucnjG5QIsVEp0Vpn7h7M51FH3Q=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/xTvyyoF_LZY/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "r7Rn4ryE_w8",
    title: "Sunflower",
    artists: [{ name: "Post Malone, Swae Lee" }],
    duration: 158,
    durationFormatted: "2:38",
    poster: "https://yt3.googleusercontent.com/IBwK4LOs4sO-Cd-_5YO4XC2B2N1hvyBvKfr60tT_ljIuwmOuVWWW2NypbcvzKgScVAbRsWEYbmsjfcm2cw=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/r7Rn4ryE_w8/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "nujn6wbr-e8",
    title: "As It Was",
    artists: [{ name: "Harry Styles" }],
    duration: 167,
    durationFormatted: "2:47",
    poster: "https://yt3.googleusercontent.com/F618Qwn2yRlYhCqlMtEMnFHajg4rGZSGeWOF4ro7l3I9R6y7aGfowqqiNQqj6CgVR0yepTK6T5aRSfAF=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/nujn6wbr-e8/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "3_g2un5M350",
    title: "Starboy",
    artists: [{ name: "The Weeknd, Daft Punk" }],
    duration: 230,
    durationFormatted: "3:50",
    poster: "https://yt3.googleusercontent.com/dcxXIIlest09vnvKznWM9VWQXu1EL7lKxBzXGzwgmVjmMNBm1dEWT_0qn1xrEZYyKF_qRE1TLq8P_JY_mQ=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/3_g2un5M350/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "NJAv_7lHUIU",
    title: "Kesariya",
    artists: [{ name: "Pritam, Arijit Singh" }],
    duration: 268,
    durationFormatted: "4:28",
    poster: "https://yt3.googleusercontent.com/CH0SThQN0HOk2eV81GGA-Tiftn58G48iy8lEyKNXJjbDSI9ApKKnmt4ncwr5gO_mZoQvFF3HPfHtky1Y=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/NJAv_7lHUIU/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "kTJczUoc26U",
    title: "STAY",
    artists: [{ name: "The Kid LAROI, Justin Bieber" }],
    duration: 141,
    durationFormatted: "2:21",
    poster: "https://i.ytimg.com/vi/kTJczUoc26U/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/kTJczUoc26U/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "kJQP7kiw5Fk",
    title: "Despacito",
    artists: [{ name: "Luis Fonsi, Daddy Yankee" }],
    duration: 228,
    durationFormatted: "3:48",
    poster: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "7wtfhZwyrcc",
    title: "Believer",
    artists: [{ name: "Imagine Dragons" }],
    duration: 204,
    durationFormatted: "3:24",
    poster: "https://i.ytimg.com/vi/7wtfhZwyrcc/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/7wtfhZwyrcc/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "HqHM91Pq0lQ",
    title: "Not Like Us",
    artists: [{ name: "Kendrick Lamar" }],
    duration: 274,
    durationFormatted: "4:34",
    poster: "https://i.ytimg.com/vi/HqHM91Pq0lQ/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/HqHM91Pq0lQ/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "fJ9rUzIMcZQ",
    title: "Bohemian Rhapsody",
    artists: [{ name: "Queen" }],
    duration: 359,
    durationFormatted: "5:59",
    poster: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg",
    source: "YouTube Music"
  }
];

// Fallback Quick Picks with popular verified tracks
const FALLBACK_QUICK_PICKS: Track[] = [
  {
    videoId: "NJAv_7lHUIU",
    title: "Kesariya",
    artists: [{ name: "Arijit Singh, Pritam" }],
    duration: 268,
    durationFormatted: "4:28",
    poster: "https://yt3.googleusercontent.com/CH0SThQN0HOk2eV81GGA-Tiftn58G48iy8lEyKNXJjbDSI9ApKKnmt4ncwr5gO_mZoQvFF3HPfHtky1Y=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/NJAv_7lHUIU/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "cl0a3i2wFcc",
    title: "Lover",
    artists: [{ name: "Diljit Dosanjh" }],
    duration: 191,
    durationFormatted: "3:11",
    poster: "https://i.ytimg.com/vi/cl0a3i2wFcc/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/cl0a3i2wFcc/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "VNs_cCtdbPc",
    title: "Brown Munde",
    artists: [{ name: "AP Dhillon, Gurinder Gill" }],
    duration: 268,
    durationFormatted: "4:28",
    poster: "https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "oiKj0Z_Xnjc",
    title: "Dance The Night",
    artists: [{ name: "Dua Lipa" }],
    duration: 176,
    durationFormatted: "2:56",
    poster: "https://i.ytimg.com/vi/oiKj0Z_Xnjc/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/oiKj0Z_Xnjc/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "V1Pl8CzNzCw",
    title: "Chaleya",
    artists: [{ name: "Anirudh Ravichander, Arijit Singh" }],
    duration: 200,
    durationFormatted: "3:20",
    poster: "https://i.ytimg.com/vi/V1Pl8CzNzCw/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/V1Pl8CzNzCw/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "DyDfgMOUjCI",
    title: "Bad Guy",
    artists: [{ name: "Billie Eilish" }],
    duration: 194,
    durationFormatted: "3:14",
    poster: "https://i.ytimg.com/vi/DyDfgMOUjCI/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/DyDfgMOUjCI/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "J7p4bzqLvCw",
    title: "Blinding Lights",
    artists: [{ name: "The Weeknd" }],
    duration: 200,
    durationFormatted: "3:20",
    poster: "https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/J7p4bzqLvCw/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "DlFXDl_ROAM",
    title: "Die With A Smile",
    artists: [{ name: "Lady Gaga, Bruno Mars" }],
    duration: 251,
    durationFormatted: "4:11",
    poster: "https://yt3.googleusercontent.com/RFK4wHeGqwI3DndbARbRJB21IC0TcmqnrlyjxYK7T-nC8wlIVbfxNaCIFKNvSpchDKmYyVLe1RN36w=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/DlFXDl_ROAM/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "kIft-LUHHVA",
    title: "Espresso",
    artists: [{ name: "Sabrina Carpenter" }],
    duration: 175,
    durationFormatted: "2:55",
    poster: "https://i.ytimg.com/vi/kIft-LUHHVA/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/kIft-LUHHVA/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "OsfAnsMY21M",
    title: "Levitating",
    artists: [{ name: "Dua Lipa" }],
    duration: 203,
    durationFormatted: "3:23",
    poster: "https://yt3.googleusercontent.com/UpJ_IhBqyhQV9b2UGcDxxWDm14kRQ2eY1o9S96AGsbE7Ol8isbpbPA0Yefvg8S8ZGAX9L1g4xaj21zVJ=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/OsfAnsMY21M/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "xTvyyoF_LZY",
    title: "Shape of You",
    artists: [{ name: "Ed Sheeran" }],
    duration: 233,
    durationFormatted: "3:53",
    poster: "https://yt3.googleusercontent.com/TMbA3LImAL96nFkm5cI1x6LiEMvMbRg4IRxEeABd9qpXsfmwKhZHRD1MucnjG5QIsVEp0Vpn7h7M51FH3Q=w544-h544-l90-rj",
    fallbackPoster: "https://i.ytimg.com/vi/xTvyyoF_LZY/mqdefault.jpg",
    source: "YouTube Music"
  },
  {
    videoId: "kTJczUoc26U",
    title: "STAY",
    artists: [{ name: "The Kid LAROI, Justin Bieber" }],
    duration: 141,
    durationFormatted: "2:21",
    poster: "https://i.ytimg.com/vi/kTJczUoc26U/mqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/kTJczUoc26U/mqdefault.jpg",
    source: "YouTube Music"
  }
];

export default function Home() {
  const {
    playTrack,
    addToQueue,
    currentTrack,
    isPlaying,
    homeSections,
    setHomeSections,
    openArtistModal,
    playHistory,
    favorites
  } = usePlayerStore();

  const [sections, setSections] = useState<Section[]>(() => {
    if (homeSections && homeSections.length > 0) return homeSections;
    return [{ title: "Top Trending Hits", subtitle: "MUSIC THAT'S HOT AND HAPPENING!", tracks: FALLBACK_TRENDING_HITS }];
  });

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [moodSections, setMoodSections] = useState<Section[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addedVideoId, setAddedVideoId] = useState<string | null>(null);

  // Personalized section state matching user listening history
  const [recommendedSection, setRecommendedSection] = useState<Section | null>(null);
  const lastTasteFingerprintRef = useRef<string>('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Filter out unofficial remixes, slowed/reverb, bootlegs, edits, instrumentals, lofi
function isPopularOriginalTrack(track: Track): boolean {
  if (!track || !track.title) return false;
  const title = track.title.toLowerCase();
  const artistNames = (track.artists || [])
    .map(a => ((typeof a === 'object' && a !== null ? (a as any).name : String(a)) || '').toLowerCase())
    .join(' ');

  const badKeywords = [
    'remix', 're-mix', 'slowed', 'reverb', 'sped up', 'speed up', 'speedup',
    'nightcore', 'bass boosted', 'instrumental', 'karaoke', 'cover', 'mashup',
    'bootleg', '8d audio', 'tiktok', 'ringtone', 'status', 'chipmunk',
    'parody', 'tribute', 'clean version', 'acoustic version', 'live performance',
    'radio edit', 'phonk remix', 'sigma', 'loop edit', 'fan made', 'fan-made',
    'lofi', 'lo-fi', 'chill mix', 'chillout', 'club mix', 'extended mix', 'dj mix',
    'dj edit', 'dj version', 'mix', 'remake'
  ];
  for (const kw of badKeywords) {
    if (title.includes(kw)) return false;
  }
  if (artistNames.includes('slowed') || artistNames.includes('reverb') || artistNames.includes('nightcore') || artistNames.includes('bass boost') || artistNames.includes('tiktok')) {
    return false;
  }
  if (track.duration && (track.duration < 60 || track.duration > 660)) {
    return false;
  }
  return true;
}

  // 1. FETCH DEFAULT HOME SECTIONS - ALWAYS REVALIDATE WITH POPULAR SONGS ON EACH LOAD
  useEffect(() => {
    // Show cached or persistent sections immediately for 0ms layout flash
    if (homeSections && homeSections.length > 0) {
      setSections(homeSections);
    } else {
      const cached = getClientCache<Section[]>('home_sections_v7');
      if (cached && cached.length > 0) {
        setSections(cached);
        setHomeSections(cached);
      }
    }

    // Always fetch fresh popular songs every time the website is loaded
    fetch(`${backendUrl}/api/home`)
      .then(res => res.json())
      .then(data => {
        let newSections: Section[] = [];
        if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
          newSections = data.sections.map((s: any) => ({
            title: s.title,
            subtitle: s.subtitle || (
              s.title.includes('Hits') || s.title.includes('Trending') || s.title.includes('Chartbusters') || s.title.includes('Bangers')
                ? "MUSIC THAT'S HOT AND HAPPENING!"
                : "CURATED FOR YOU"
            ),
            tracks: (s.tracks || []).filter(isPopularOriginalTrack)
          })).filter((s: Section) => s.tracks.length >= 3);
        } else if (data.tracks && Array.isArray(data.tracks)) {
          const cleanTracks = data.tracks.filter(isPopularOriginalTrack);
          if (cleanTracks.length > 0) {
            newSections = [{
              title: "Today's Biggest Hits",
              subtitle: "MUSIC THAT'S HOT AND HAPPENING!",
              tracks: cleanTracks
            }];
          }
        }
        if (newSections.length > 0) {
          setSections(newSections);
          setHomeSections(newSections);
          setClientCache('home_sections_v7', newSections, 1800);
        }
      })
      .catch((err) => {
        console.error("Home fetch error:", err);
      });
  }, [backendUrl, setHomeSections]);

  // 2. DYNAMIC PERSONALIZED RECOMMENDATIONS (Spotify/YT Music algorithmic discovery, excluding raw recent play history)
  useEffect(() => {
    // 1. Analyze user taste profile: Top played & favorited artists
    const artistCounts: Record<string, number> = {};
    const playedVideoIds = new Set<string>();

    playHistory.forEach(item => {
      if (!item?.track?.videoId) return;
      playedVideoIds.add(item.track.videoId);
      const firstA = item.track.artists?.[0];
      const name = firstA ? (typeof firstA === 'string' ? firstA : firstA.name) : '';
      if (name && name !== 'Unknown Artist' && name !== 'Various Artists') {
        artistCounts[name] = (artistCounts[name] || 0) + (item.playCount || 1) * 2;
      }
    });

    favorites.forEach(t => {
      if (!t?.videoId) return;
      const firstA = t.artists?.[0];
      const name = firstA ? (typeof firstA === 'string' ? firstA : firstA.name) : '';
      if (name && name !== 'Unknown Artist' && name !== 'Various Artists') {
        artistCounts[name] = (artistCounts[name] || 0) + 3;
      }
    });

    const topArtists = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]);
    const topArtist = topArtists[0];

    // Seed track: most played track across all history or first favorite (algorithmic anchor)
    const sortedByPlayCount = [...playHistory].sort((a, b) => (b.playCount || 1) - (a.playCount || 1));
    const seedTrack = sortedByPlayCount[0]?.track || favorites[0];

    // Compute stable fingerprint: only regenerate if the user's taste anchor actually changes
    const currentFingerprint = `${topArtist || 'none'}:${seedTrack?.videoId || 'none'}`;
    if (recommendedSection && lastTasteFingerprintRef.current === currentFingerprint) {
      return; // Keep carousel stable while user is listening, no jumping or appending!
    }
    lastTasteFingerprintRef.current = currentFingerprint;

    if (seedTrack?.videoId || topArtist) {
      const cacheKey = `m4u_v8_${encodeURIComponent(currentFingerprint)}`;
      const cached = getClientCache<Track[]>(cacheKey);

      if (cached && cached.length > 0) {
        // Exclude recent played tracks so it's genuine discoveries!
        const cleanDiscoveries = cached.filter(t => !playedVideoIds.has(t.videoId) && isPopularOriginalTrack(t));
        const finalTracks = cleanDiscoveries.length >= 6 ? cleanDiscoveries : cached.filter(isPopularOriginalTrack);
        setRecommendedSection({
          title: "Made For You",
          subtitle: topArtist ? `BASED ON YOUR LOVE FOR ${topArtist.toUpperCase()}` : "RECOMMENDED FOR YOUR TASTE",
          tracks: finalTracks.slice(0, 16)
        });
        return;
      }

      // Query recommendation pipeline: radio endpoint first for true algorithmic similarities, fallback to top artist search
      const fetchPromise = seedTrack?.videoId
        ? fetch(`${backendUrl}/api/radio/${seedTrack.videoId}`).then(r => r.json()).then(data => data.tracks || [])
        : fetch(`${backendUrl}/api/search?q=${encodeURIComponent(topArtist)}&filter=songs`).then(r => r.json());

      fetchPromise
        .then((tracks: Track[]) => {
          if (Array.isArray(tracks) && tracks.length > 0) {
            // Strictly exclude tracks the user has already played (never add recent played songs one after another!)
            const cleanDiscoveries = tracks.filter((t: Track) => !playedVideoIds.has(t.videoId) && isPopularOriginalTrack(t));
            const tracksToShow = cleanDiscoveries.length >= 6 ? cleanDiscoveries : tracks.filter(isPopularOriginalTrack);
            if (tracksToShow.length > 0) {
              setClientCache(cacheKey, tracksToShow, 3600);
              setRecommendedSection({
                title: "Made For You",
                subtitle: topArtist ? `BASED ON YOUR LOVE FOR ${topArtist.toUpperCase()}` : "RECOMMENDED FOR YOUR TASTE",
                tracks: tracksToShow.slice(0, 16)
              });
            }
          }
        })
        .catch(() => {});
    } else {
      // Default curated starter for fresh users without prior listening history
      setRecommendedSection({
        title: "Made For You",
        subtitle: "CURATED DISCOVERIES TO START YOUR VIBE",
        tracks: FALLBACK_QUICK_PICKS
      });
    }
  }, [playHistory, favorites, backendUrl, recommendedSection]);

  // 3. HANDLE MOOD / ACTIVITY FILTER CHIPS DYNAMICALLY
  useEffect(() => {
    if (selectedFilter === "All") {
      setMoodSections([]);
      setMoodLoading(false);
      return;
    }

    const config = MOOD_CONFIG[selectedFilter];
    if (!config) return;

    const cacheKey = `mood_sections_${selectedFilter}`;
    const cached = getClientCache<Section[]>(cacheKey);
    if (cached && cached.length > 0) {
      setMoodSections(cached);
      setMoodLoading(false);
      return;
    }

    setMoodLoading(true);

    Promise.all([
      fetch(`${backendUrl}/api/search?q=${encodeURIComponent(config.query1)}&filter=songs`).then(r => r.json()).catch(() => []),
      fetch(`${backendUrl}/api/search?q=${encodeURIComponent(config.query2)}&filter=songs`).then(r => r.json()).catch(() => [])
    ])
      .then(([tracks1, tracks2]) => {
        const resultSections: Section[] = [];
        if (Array.isArray(tracks1) && tracks1.length > 0) {
          resultSections.push({
            title: config.title1,
            subtitle: config.subtitle1,
            tracks: tracks1.slice(0, 15)
          });
        }
        if (Array.isArray(tracks2) && tracks2.length > 0) {
          resultSections.push({
            title: config.title2,
            subtitle: config.subtitle2,
            tracks: tracks2.slice(0, 15)
          });
        }

        setMoodSections(resultSections);
        setClientCache(cacheKey, resultSections, 3600);
        setMoodLoading(false);
      })
      .catch((err) => {
        console.error("Mood fetch error:", err);
        setMoodLoading(false);
      });
  }, [selectedFilter, backendUrl]);

  const handlePlaySong = useCallback((track: Track, sectionTracks: Track[]) => {
    if (currentTrack?.videoId === track.videoId) {
      if (isPlaying) {
        audioPlayer.pause();
      } else {
        audioPlayer.play();
      }
      return;
    }

    const formattedTrack: Track = {
      videoId: track.videoId,
      title: track.title,
      artists: track.artists || [{ name: 'Unknown Artist' }],
      album: track.album,
      duration: typeof track.duration === 'number' ? track.duration : 210,
      durationFormatted: track.durationFormatted || '3:30',
      thumbnails: track.thumbnails,
      poster: track.poster,
      fallbackPoster: track.fallbackPoster
    };

    const formattedQueue: Track[] = sectionTracks.map(t => ({
      videoId: t.videoId,
      title: t.title,
      artists: t.artists || [{ name: 'Unknown Artist' }],
      album: t.album,
      duration: typeof t.duration === 'number' ? t.duration : 210,
      durationFormatted: t.durationFormatted || '3:30',
      thumbnails: t.thumbnails,
      poster: t.poster,
      fallbackPoster: t.fallbackPoster
    }));

    playTrack(formattedTrack, formattedQueue);
  }, [currentTrack?.videoId, isPlaying, playTrack]);

  const handleAddToQueue = useCallback((e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const formattedTrack: Track = {
      videoId: track.videoId,
      title: track.title,
      artists: track.artists || [{ name: 'Unknown Artist' }],
      album: track.album,
      duration: typeof track.duration === 'number' ? track.duration : 210,
      durationFormatted: track.durationFormatted || '3:30',
      thumbnails: track.thumbnails,
      poster: track.poster,
      fallbackPoster: track.fallbackPoster
    };
    addToQueue(formattedTrack);
    setAddedVideoId(track.videoId);
    setTimeout(() => setAddedVideoId(null), 1500);
  }, [addToQueue]);

  // Segregate default home sections
  const trendingSection = useMemo(() => {
    return sections.find(s => s.title.toLowerCase().includes('trending') || s.title.toLowerCase().includes('biggest')) || sections[0] || {
      title: "Top Trending Hits",
      subtitle: "MUSIC THAT'S HOT AND HAPPENING!",
      tracks: FALLBACK_TRENDING_HITS
    };
  }, [sections]);

  const quickPicksTracks = useMemo(() => {
    const qpSec = sections.find(s => s.title.toLowerCase().includes('quick'));
    if (qpSec && qpSec.tracks.length > 0) return qpSec.tracks;
    if (sections.length > 1 && sections[1]?.tracks?.length > 0) return sections[1].tracks;
    return FALLBACK_QUICK_PICKS;
  }, [sections]);

  const otherSections = useMemo(() => {
    return sections.filter(s => s !== trendingSection && !s.title.toLowerCase().includes('quick'));
  }, [sections, trendingSection]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16 select-none">
      {/* Horizontal Mood / Activity Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 hide-scrollbar -mx-1 px-1">
        {FILTER_CHIPS.map((chip) => {
          const isSelected = selectedFilter === chip;
          return (
            <button
              key={chip}
              onClick={() => setSelectedFilter(chip)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-white text-black shadow-md scale-105'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-[#d4d4d8] hover:text-white border border-white/5'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{chip}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Content: Mood View OR Default Categorized Home */}
      {selectedFilter !== "All" ? (
        /* ================= MOOD FILTER VIEW ================= */
        <div className="space-y-8 animate-in fade-in duration-300">
          {moodLoading ? (
            <div className="space-y-8">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="h-3 w-36 bg-neutral-800 rounded animate-pulse" />
                  <div className="h-6 w-56 bg-neutral-800 rounded animate-pulse" />
                  <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="w-36 sm:w-44 flex-shrink-0 space-y-2">
                        <div className="aspect-square bg-neutral-800 rounded-xl animate-pulse" />
                        <div className="h-4 bg-neutral-800 rounded w-3/4 animate-pulse" />
                        <div className="h-3 bg-neutral-800 rounded w-1/2 animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : moodSections.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-neutral-400">
              <Headphones className="w-10 h-10 mx-auto opacity-50 text-[#00d2c4]" />
              <p className="text-base font-semibold text-white">Loading {selectedFilter} music...</p>
              <p className="text-xs">Finding the best tracks for your mood</p>
            </div>
          ) : (
            <>
              {/* Mood Category 1 Carousel */}
              {moodSections[0] && (
                <SongCarousel
                  title={moodSections[0].title}
                  subtitle={moodSections[0].subtitle}
                >
                  {moodSections[0].tracks.map((track, idx) => (
                    <SongCard
                      key={`mood-1-${track.videoId}-${idx}`}
                      track={track}
                      sectionTracks={moodSections[0].tracks}
                      onPlay={handlePlaySong}
                    />
                  ))}
                </SongCarousel>
              )}

              {/* Mood Quick Picks (Top 8 songs in responsive grid) */}
              {moodSections[0]?.tracks?.length > 0 && (
                <section className="space-y-3 pt-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#9e9ea7]">
                      TOP PICKS FOR {selectedFilter.toUpperCase()}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      Quick Picks
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {moodSections[0].tracks.slice(0, 8).map((track, idx) => {
                      const isThisPlaying = currentTrack?.videoId === track.videoId && isPlaying;
                      const isJustAdded = addedVideoId === track.videoId;

                      return (
                        <div
                          key={`mood-qp-${track.videoId}-${idx}`}
                          onClick={() => handlePlaySong(track, moodSections[0].tracks)}
                          className="group flex items-center gap-3 p-2 rounded-xl hover:bg-[#1a1a1e] transition-colors duration-150 cursor-pointer"
                        >
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-sm">
                            <MusicPoster
                              src={track.poster || track.thumbnails?.[0]?.url}
                              fallbackSrc={track.fallbackPoster}
                              videoId={track.videoId}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />

                            {isThisPlaying ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
                                <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-1" />
                                <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-2" />
                                <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-3" />
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold truncate ${isThisPlaying ? 'text-[#00d2c4]' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p
                              onClick={(e) => {
                                e.stopPropagation();
                                const firstA = track.artists?.[0];
                                const aName = firstA ? (typeof firstA === 'string' ? firstA : firstA.name) : 'Artist';
                                const aId = typeof firstA === 'object' ? firstA.id : undefined;
                                openArtistModal({
                                  name: aName,
                                  id: aId,
                                  avatar: track.poster || track.thumbnails?.[0]?.url
                                });
                              }}
                              className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 cursor-pointer"
                            >
                              {track.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || 'Various Artists'}
                            </p>
                          </div>

                          {currentTrack && (
                            <button
                              onClick={(e) => handleAddToQueue(e, track)}
                              className="p-2 text-neutral-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Add to Up Next"
                            >
                              {isJustAdded ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Mood Category 2 Carousel */}
              {moodSections[1] && (
                <SongCarousel
                  title={moodSections[1].title}
                  subtitle={moodSections[1].subtitle}
                >
                  {moodSections[1].tracks.map((track, idx) => (
                    <SongCard
                      key={`mood-2-${track.videoId}-${idx}`}
                      track={track}
                      sectionTracks={moodSections[1].tracks}
                      onPlay={handlePlaySong}
                    />
                  ))}
                </SongCarousel>
              )}
            </>
          )}
        </div>
      ) : (
        /* ================= DEFAULT "ALL" HOME VIEW ================= */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Section 1: Top Trending Hits Carousel */}
          <SongCarousel
            title={trendingSection.title}
            subtitle={trendingSection.subtitle || "MUSIC THAT'S HOT AND HAPPENING!"}
          >
            {trendingSection.tracks.map((track, idx) => (
              <SongCard
                key={`trending-${track.videoId}-${idx}`}
                track={track}
                sectionTracks={trendingSection.tracks}
                onPlay={handlePlaySong}
              />
            ))}
          </SongCarousel>

          {/* Section 2: Matches Your Taste / Made For You (Personalized from Listening History) */}
          {recommendedSection && recommendedSection.tracks.length > 0 && (
            <SongCarousel
              title={recommendedSection.title}
              subtitle={recommendedSection.subtitle}
            >
              {recommendedSection.tracks.map((track, idx) => (
                <SongCard
                  key={`rec-${track.videoId}-${idx}`}
                  track={track}
                  sectionTracks={recommendedSection.tracks}
                  onPlay={handlePlaySong}
                />
              ))}
            </SongCarousel>
          )}

          {/* Section 3: Quick Picks (Responsive Grid with Equalizer Animation) */}
          <section className="space-y-3 pt-2">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9e9ea7]">
                RECOMMENDED FOR YOU
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Quick picks
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {quickPicksTracks.map((track, idx) => {
                const isThisPlaying = currentTrack?.videoId === track.videoId && isPlaying;
                const isJustAdded = addedVideoId === track.videoId;

                return (
                  <div
                    key={`qp-${track.videoId}-${idx}`}
                    onClick={() => handlePlaySong(track, quickPicksTracks)}
                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-[#1a1a1e] transition-colors duration-150 cursor-pointer"
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-sm">
                      <MusicPoster
                        src={track.poster || track.thumbnails?.[0]?.url}
                        fallbackSrc={track.fallbackPoster}
                        videoId={track.videoId}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />

                      {isThisPlaying ? (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
                          <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-1" />
                          <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-2" />
                          <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-3" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-semibold truncate ${isThisPlaying ? 'text-[#00d2c4]' : 'text-white'}`}>
                        {track.title}
                      </h4>
                      <p
                        onClick={(e) => {
                          e.stopPropagation();
                          const firstA = track.artists?.[0];
                          const aName = firstA ? (typeof firstA === 'string' ? firstA : firstA.name) : 'Artist';
                          const aId = typeof firstA === 'object' ? firstA.id : undefined;
                          openArtistModal({
                            name: aName,
                            id: aId,
                            avatar: track.poster || track.thumbnails?.[0]?.url
                          });
                        }}
                        className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 cursor-pointer"
                        title="View Artist Profile"
                      >
                        {track.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || 'Unknown Artist'}
                      </p>
                    </div>

                    {currentTrack && (
                      <button
                        onClick={(e) => handleAddToQueue(e, track)}
                        className="p-2 text-neutral-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Add to Up Next"
                      >
                        {isJustAdded ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 4+: All Curated Backend Category Carousels */}
          {otherSections.map((sec, sIdx) => (
            <SongCarousel
              key={`extra-${sec.title}-${sIdx}`}
              title={sec.title}
              subtitle={sec.subtitle || "RECOMMENDED FOR YOU"}
            >
              {sec.tracks.map((track, idx) => (
                <SongCard
                  key={`sec-${sec.title}-${track.videoId}-${idx}`}
                  track={track}
                  sectionTracks={sec.tracks}
                  onPlay={handlePlaySong}
                />
              ))}
            </SongCarousel>
          ))}
        </div>
      )}
    </div>
  );
}
