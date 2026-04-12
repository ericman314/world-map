import { google } from 'googleapis'
import fs from 'fs/promises'

const SPREADSHEET_ID = '1HapyA3PvUsphzN58ZvyKhez2eaHwqWxVaCCGy2AmBfA'
const SHEET_NAME = 'Main'
const KEY_FILE = './keys/crucial-matter-142002-6d78ee7b9661.json'
const OUTPUT_FILE = './missionary-data/missionary-names.jsonc'

// Column indices (0-based) from the header row
const COL = {
  NAME: 0,
  DISPLAY_NAME: 1,
  MISSION: 2,
  START_DATE: 3,
  END_DATE: 4,
  WARD: 5,
  PERCENT_COMPLETE: 6,
  PRINTED: 7,
}

async function fetchSheetData() {
  const keyContent = await fs.readFile(KEY_FILE, 'utf-8')
  const key = JSON.parse(keyContent)

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME,
  })

  return res.data.values
}

function appendMissionSuffix(mission) {
  if (!mission) return ''
  // Some missions already have "Mission" in the name (e.g. "Church-Service Mission", "Utah Spanish Fork Mission")
  if (mission.endsWith('Mission')) return mission

  // Some missions do not have "Mission" in the name at all
  if (mission.match(/historic sites/i)) return mission

  // For all other missions, append "Mission" suffix
  return mission + ' Mission'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  // Input: "D Mon YYYY" (e.g. "25 Aug 2025") -> Output: "Mon DD, YYYY" (e.g. "Aug 25, 2025")
  const match = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (!match) return dateStr // return as-is if it doesn't match expected format
  const [, day, month, year] = match
  return `${month} ${day}, ${year}`
}

function deriveImageName(displayName) {
  return displayName.replace(/\s+/g, '_') + '.png'
}

function transformRow(row) {
  const displayName = (row[COL.DISPLAY_NAME] || '').trim()
  if (!displayName) return null

  const mission = (row[COL.MISSION] || '').trim()
  const startDate = (row[COL.START_DATE] || '').trim()
  const endDate = (row[COL.END_DATE] || '').trim()
  const ward = (row[COL.WARD] || '').trim()
  const printed = (row[COL.PRINTED] || '').trim().toUpperCase() === 'TRUE'

  const sortKey = (row[COL.NAME] || '').trim().toLowerCase()

  const entry = {
    sortKey,
    name: displayName,
    image: deriveImageName(displayName),
    ward,
    mission: appendMissionSuffix(mission),
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    printed,
  }

  // Senior couples get overrideWidth
  if (displayName.startsWith('Elder and Sister')) {
    entry.overrideWidth = 600
  }

  // Validation warnings
  const rowLabel = `Row "${displayName}"`
  if (ward && !ward.endsWith('Ward')) {
    console.warn(`⚠ ${rowLabel}: ward "${ward}" does not end with "Ward"`)
  }
  if (mission && /Mission.*Mission/.test(appendMissionSuffix(mission))) {
    console.warn(`⚠ ${rowLabel}: mission "${mission}" already contains "Mission"`)
  }
  if (!displayName.startsWith('Elder') && !displayName.startsWith('Sister')) {
    console.warn(`⚠ ${rowLabel}: display name does not start with "Elder" or "Sister"`)
  }

  return entry
}

export async function fetchMissionaryData() {
  const rows = await fetchSheetData()
  if (!rows || rows.length < 2) {
    throw new Error('No data found in spreadsheet')
  }

  // Skip header row
  const dataRows = rows.slice(1)

  const seenDisplayNames = new Set()
  const missionaries = []

  for (const row of dataRows) {
    const entry = transformRow(row)
    if (!entry) continue

    // Deduplicate senior couples (same display name = use first row only)
    if (seenDisplayNames.has(entry.name)) continue
    seenDisplayNames.add(entry.name)

    missionaries.push(entry)
  }

  // Sort by the Name column (Last, First) which sorts by last name naturally
  missionaries.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  // Remove sortKey before output
  missionaries.forEach(m => delete m.sortKey)

  console.log(`Fetched ${missionaries.length} missionaries from Google Sheet`)
  return missionaries
}

// Run standalone if executed directly
const isMain = process.argv[1]?.endsWith('sync-from-sheet.mjs')
if (isMain) {
  fetchMissionaryData().then(async (missionaries) => {
    const json = JSON.stringify(missionaries, null, 2)
    await fs.writeFile(OUTPUT_FILE, json + '\n')
    console.log(`Wrote ${missionaries.length} missionaries to ${OUTPUT_FILE}`)
  })
}
