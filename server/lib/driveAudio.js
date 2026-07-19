// lib/driveAudio.js — streams a Google Drive-hosted audio file's raw bytes
// through OUR OWN origin instead of embedding Drive's /preview iframe.
//
// WHY: Drive's /preview embed comes with Google's own player UI (play/pause,
// seek bar, speed, fullscreen) that we have no way to restrict — a student
// could pause or scrub through the recording. By fetching the actual file
// bytes server-side and handing them to our own <audio> element (the
// no-controls, autoplay-once AudioPlayer component), the recording behaves
// exactly like any other listening test: one uninterrupted playthrough.
//
// Google Drive quirk: for some files, a direct download request returns an
// HTML "can't scan this file for viruses" interstitial instead of the file
// itself. That page contains a `confirm=` token that, resubmitted, returns
// the real file. We handle that automatically below.

const DOWNLOAD_BASE = 'https://drive.google.com/uc?export=download';

async function fetchOnce(fileId, extra = '', headers = {}) {
  return fetch(`${DOWNLOAD_BASE}&id=${encodeURIComponent(fileId)}${extra}`, {
    redirect: 'follow',
    headers
  });
}

// Returns { res } where res.body is a readable stream of the actual file
// bytes, plus whatever content-type / content-length / range headers Drive
// gave us for that final response.
async function fetchDriveFile(fileId, rangeHeader) {
  const headers = rangeHeader ? { range: rangeHeader } : {};
  let res = await fetchOnce(fileId, '', headers);
  const ct = res.headers.get('content-type') || '';

  if (ct.includes('text/html')) {
    // Virus-scan warning page instead of the file — pull the confirm token
    // (and any cookie Drive set) out of the page and retry once.
    const text = await res.text();
    const tokenMatch = text.match(/confirm=([0-9A-Za-z_-]+)/) || text.match(/name="confirm"\s+value="([0-9A-Za-z_-]+)"/);
    if (!tokenMatch) {
      throw new Error('Could not fetch the audio from Google Drive — check the file is shared as "Anyone with the link".');
    }
    const setCookie = res.headers.get('set-cookie');
    const retryHeaders = { ...headers };
    if (setCookie) retryHeaders.cookie = setCookie;
    res = await fetchOnce(fileId, `&confirm=${tokenMatch[1]}`, retryHeaders);
  }

  if (!res.ok && res.status !== 206) {
    throw new Error(`Google Drive returned an error (status ${res.status}) — check the file's sharing settings.`);
  }
  return res;
}

module.exports = { fetchDriveFile };
