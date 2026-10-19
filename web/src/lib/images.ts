/**
 * Photography. Every photo was checked individually on its Unsplash page on 2026-10-19:
 * "Free to use under the Unsplash License" (not Unsplash+), original resolution read from the CDN.
 * The Unsplash License allows commercial use without attribution; we credit photographers anyway.
 * No IPL/BCCI/team logos or player photographs are used.
 */
export type Photo = {
  src: string;
  alt: string;
  photographer: string;
  profile: string;
  page: string;
  location: string;
  original: string;
};

const LICENSE_URL = "https://unsplash.com/license";
export { LICENSE_URL };

export const photos = {
  delhiPanorama: {
    src: "https://images.unsplash.com/photo-1774168062260-b0a1b63026ba",
    alt: "Wide view of a floodlit cricket stadium with a green outfield during a match",
    photographer: "Zoshua Colah",
    profile: "https://unsplash.com/@zoshuacolah",
    page: "https://unsplash.com/photos/a-cricket-stadium-with-green-field-and-blue-sky-O6iN5l1cIwE",
    location: "Arun Jaitley Stadium, New Delhi",
    original: "4000 × 2252",
  },
  dyPatilCrowd: {
    src: "https://images.unsplash.com/photo-1652513842544-ca66b676757a",
    alt: "Cricket field seen from packed stands",
    photographer: "Harsadh Vikhaas Rajesh Kumar",
    profile: "https://unsplash.com/@harsadh",
    page: "https://unsplash.com/photos/a-sports-field-with-a-crowd-of-people-in-the-stands-uwxNqKHi75U",
    location: "D Y Patil Stadium, Navi Mumbai",
    original: "4032 × 2268",
  },
  delhiSpectators: {
    src: "https://images.unsplash.com/photo-1774167287506-704e630b3e6b",
    alt: "Spectators in the stands watching a live cricket match",
    photographer: "Zoshua Colah",
    profile: "https://unsplash.com/@zoshuacolah",
    page: "https://unsplash.com/photos/spectators-watch-a-cricket-match-from-stadium-seats-1gthXiQH5SU",
    location: "Arun Jaitley Stadium, New Delhi",
    original: "7144 × 4502",
  },
  galle: {
    src: "https://images.unsplash.com/photo-1745180267520-a0c46ff024ae",
    alt: "Cricket match in progress with players in whites and a historic clock tower behind the ground",
    photographer: "Zoshua Colah",
    profile: "https://unsplash.com/@zoshuacolah",
    page: "https://unsplash.com/photos/cricket-match-in-progress-at-a-stadium-Sa7CAnKQiDU",
    location: "Galle International Stadium, Sri Lanka",
    original: "5941 × 3751",
  },
} satisfies Record<string, Photo>;
