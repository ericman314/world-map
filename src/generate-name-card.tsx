import fs from 'fs/promises'
import path from 'path'
import React, { ReactNode } from 'react'
import ReactPDF, { Font } from '@react-pdf/renderer'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { execSync } from 'child_process'

type MissionaryData = {
  name: string
  image: string
  ward: string
  mission: string | string[]
  flag: string
  startDate: string
  endDate: string
  overrideWidth?: number
  overrideHeight?: number
}[]

Font.register({
  family: "Noto Serif",
  fonts: [
    { src: path.join('/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join('/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf'), fontWeight: 'bold' }
  ]
})

// Disable hyphenation
Font.registerHyphenationCallback(word => [word])


// const dataDir = './example-data'
const dataDir = './missionary-data'

main()

async function main() {

  const missionaryData: MissionaryData = await fs.readFile(path.join(dataDir, '/missionary-names.json'), 'utf-8')
    .then(data => JSON.parse(data))

  if (!process.argv[2]) {
    console.log(`Usage: node generate-name-card.mjs <pattern>`)
    process.exit(1)
  }

  const ovalWidth = 500
  const ovalHeight = 600
  const ovalPadding = 20
  const shadowOffsetX = 5
  const shadowOffsetY = 5

  execSync(`convert -size ${ovalWidth}x${ovalHeight} xc:white \\
  -draw "ellipse ${ovalWidth / 2 + shadowOffsetX},${ovalHeight / 2 + shadowOffsetY} ${ovalWidth / 2 - ovalPadding},${ovalHeight / 2 - ovalPadding} 0,360" \\
  -blur 0x10 \\
  -alpha set \\
  xc:white \\
  -fill black \\
  -draw "ellipse ${ovalWidth / 2},${ovalHeight / 2} ${ovalWidth / 2 - ovalPadding},${ovalHeight / 2 - ovalPadding} 0,360" \\
  -alpha off \\
  -compose CopyOpacity -composite \\
  tmp-images/oval-mask.png`)

  const allNameCards: ReactNode[] = []

  for (let missionary of missionaryData) {
    if (!missionary.name.match(process.argv[2])) continue
    console.log(`Rendering name card for ${missionary.name}`)

    let width = ovalWidth
    let height = ovalHeight
    let ovalMaskImageFileName = 'oval-mask.png'

    if (missionary.overrideWidth || missionary.overrideHeight) {
      ovalMaskImageFileName = 'oval-custom.png'
      width = missionary.overrideWidth || ovalWidth
      height = missionary.overrideHeight || ovalHeight
      execSync(`convert -size ${width}x${height} xc:white \\
        -draw "ellipse ${width / 2 + shadowOffsetX},${height / 2 + shadowOffsetY} ${width / 2 - ovalPadding},${height / 2 - ovalPadding} 0,360" \\
        -blur 0x10 \\
        -alpha set \\
        xc:white \\
        -fill black \\
        -draw "ellipse ${width / 2},${height / 2} ${width / 2 - ovalPadding},${height / 2 - ovalPadding} 0,360" \\
        -alpha off \\
        -compose CopyOpacity -composite \\
        tmp-images/${ovalMaskImageFileName}`)
    }

    // Add a shadow to the flag
    let flagFilenameWithoutExt = missionary.flag.split('.').slice(0, -1).join('.')
    let flagShadowFilename = `${flagFilenameWithoutExt}.shadow.png`
    execSync(`convert flags/${missionary.flag} -resize 300x \\( +clone -background black -shadow 80x7+7+7 \\) +swap -background none -layers merge +repage flags/${flagShadowFilename}`)

    let imageWithoutExt = missionary.image.split('.').slice(0, -1).join('.')
    let imageOvalFilename = `${imageWithoutExt}.oval.png`

    // Crop the image to an oval and add a shadow

    try {
    execSync(`convert ${path.join(dataDir, missionary.image)} \\
      -resize x${width}^ -resize '${width}x${height}^' -gravity center -extent ${width}x${height} \\
      tmp-images/${ovalMaskImageFileName} -compose over -composite \\
      ${path.join(dataDir, imageOvalFilename)}`)
    } catch (ex) {
      console.error(ex)
    }

    allNameCards.push(
      <NameCard
        key={missionary.name}
        dataDir={dataDir}
        {...missionary}
        flag={flagShadowFilename}
        image={imageOvalFilename}
      />
    )
  }

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {allNameCards}
      </Page>
    </Document>
  )

  await ReactPDF.render(doc, `cards.pdf`)
}



const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    border: '1px solid black',
    textAlign: 'center',
    gap: '0.1in',
    padding: '0.25in'
  },
  card: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: "3in",
    height: "2.5in",
    backgroundColor: "white",
    border: '0.09in solid black',
    padding: '0.1in'
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Noto Serif'
  },
  mainArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  leftSide: {
    flex: 1,
  },
  image: {

    objectFit: 'contain',
    // height: 200,
    // borderRadius: '50%',
  },
  rightSide: {
    height: "100%",
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    gap: '0.05in',
  },
  ward: {
    fontSize: 9,
    fontFamily: 'Noto Serif',
    color: '#444',
    flexGrow: 0,
    marginTop: '0.05in'
  },
  missionAndFlag: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.05in',
    flexGrow: 1,
  },
  mission: {
    fontSize: 11,
    fontFamily: 'Noto Serif'
  },
  flag: {
    width: '1in',
    paddingLeft: '0.05in' // Push to the right, since after adding the shadow, the flag is no longer centered
  },
  dates: {
    fontSize: 10,
    fontFamily: 'Noto Serif',
    color: '#444'
  }
})


type NameCardProps = {
  dataDir: string
  name: string
  image: string
  ward: string
  mission: string | string[]
  flag: string
  startDate: string
  endDate: string
  overrideFontSize?: number
}

export function NameCard({ dataDir, name, image, ward, mission, flag, startDate, endDate, overrideFontSize = 16 }: NameCardProps) {

  return (
    <View style={styles.card}>

      <Text style={{ ...styles.name, fontSize: overrideFontSize }}>
        {name}
      </Text>

      <View style={styles.mainArea}>

        <View style={styles.leftSide}>
          <Image style={styles.image} src={path.join(dataDir, image)} />
        </View>

        <View style={styles.rightSide}>

          <Text style={styles.ward}>
            {ward}
          </Text>

          <View style={styles.missionAndFlag}>
            <Text style={styles.mission}>
              {mission}
            </Text>
            <Image style={styles.flag} src={path.join('flags', flag)} />
          </View>
        </View>
      </View>

      <Text style={styles.dates}>
        {startDate} &ndash; {endDate}
      </Text>

    </View>
  )
}