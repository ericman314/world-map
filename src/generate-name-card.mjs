import fs from 'fs/promises'
import sharp from 'sharp'
import path from 'path'

const dataDir = './example-data'

const missionaryData = await fs.readFile(path.join(dataDir, '/example-names.json'))
  .then(data => JSON.parse(data))

if (!process.argv[2]) {
  console.log(`Usage: node generate-name-card.mjs <pattern>`)
  process.exit(1)
}

for (let { name, image, ward, mission, flag, startDate, endDate } of missionaryData) {
  if (!name.match(process.argv[2])) continue
  console.log(`Rendering name card for ${name}`)

  // Handle mission as string or string array
  const missionText = Array.isArray(mission) ? mission.join('<br/>') : mission

  // Create SVG string
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="750" viewBox="0 0 900 750">
      <rect width="100%" height="100%" fill="white" stroke="black" stroke-width="10"/>
      <text x="50%" y="100" font-size="60" text-anchor="middle" font-family="Noto Serif">${name}</text>
      <g transform="translate(50, 150)">
        <defs>
          <clipPath id="clipOval">
            <ellipse cx="175" cy="175" rx="175" ry="225"/>
          </clipPath>
          <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
            <feOffset dx="10" dy="10" result="offsetblur"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <image x="0" y="0" width="350" height="450" href="${image}" clip-path="url(#clipOval)" filter="url(#dropShadow)"/>
      </g>
      <g transform="translate(450, 150)">
        <foreignObject x="0" y="0" width="400" height="200">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 40px; font-family: 'Noto Serif';">
            ${missionText}
          </div>
        </foreignObject>
        <image x="0" y="250" width="200" height="100" href="${flag}"/>
      </g>
      <text x="50%" y="700" font-size="40" text-anchor="middle" font-family="Noto Serif">${startDate} - ${endDate}</text>
    </svg>
  `

  // Output SVG to file
  let svgPath = `${dataDir}/card-${name.replace(/\s+/g, '_')}.svg`
  await fs.writeFile(svgPath, svg)

  // Render SVG to PNG (must load from file so that the base URL is set correctly and we can find the linked images)
  await sharp(svgPath)
    .png()
    .toFile(`${dataDir}/card-${name.replace(/\s+/g, '_')}.png`)
}
