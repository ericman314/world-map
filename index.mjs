import shapefile from 'shapefile'
import fs from 'fs/promises'

const MERIDIAN = 0//  8.5

/**
 * Parameters used for the Robinson mapping
 * Latitude, X, Y
 */
const robinsonMapping = [
  [0, 1.0000, 0.0000],
  [5, 0.9986, 0.0620],
  [10, 0.9954, 0.1240],
  [15, 0.9900, 0.1860],
  [20, 0.9822, 0.2480],
  [25, 0.9730, 0.3100],
  [30, 0.9600, 0.3720],
  [35, 0.9427, 0.4340],
  [40, 0.9216, 0.4958],
  [45, 0.8962, 0.5571],
  [50, 0.8679, 0.6176],
  [55, 0.8350, 0.6769],
  [60, 0.7986, 0.7346],
  [65, 0.7597, 0.7903],
  [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936],
  [80, 0.6213, 0.9394],
  [85, 0.5722, 0.9761],
  [90, 0.5322, 1.0000],
]

// X:
// 1 + a x^2 + b x^4 + c x^6
// a = -0.00004181872476101169
// b = -4.9649983083515e-9
// c = 3.6479433224011185e-13

// Y:
// a*x + b*x^2 + c * x^3 + d x^4 + e*x^5
// a = 0.012748213247579939
// b = -0.000031153636939792045
// c = 8.345948639672023e-7
// d = -7.196408757610037e-9
// e = -4.90512070320954e-12


/**
 * Regression of the Robinson mapping for a given latitude
 * @param {number} lat Latitude
 * @returns {Object} Interpolated X and Y
 */
function getRegressedRobinsonParameters(lat) {
  const abslat = Math.abs(lat)
  const X = 1 + -0.00004181872476101169 * abslat ** 2 + -4.9649983083515e-9 * abslat ** 4 + 3.6479433224011185e-13 * abslat ** 6
  const Y = 0.012748213247579939 * abslat + -0.000031153636939792045 * abslat ** 2 + 8.345948639672023e-7 * abslat ** 3 + -7.196408757610037e-9 * abslat ** 4 + -4.90512070320954e-12 * abslat ** 5
  return {
    X,
    Y: Math.sign(lat) * Y
  }
}

/**
 * Linear interpolation of the Robinson mapping for a given latitude
 * @param {number} lat Latitude
 * @returns {Object} Interpolated X and Y
 */
function getInterpolateRobinsonParameters(lat) {
  const abslat = Math.abs(lat)
  let index = Math.floor(abslat / 5)

  if (index < 0) index = 0
  if (index > robinsonMapping.length - 2) index = robinsonMapping.length - 2

  let lat1 = robinsonMapping[index][0]
  let X1 = robinsonMapping[index][1]
  let Y1 = robinsonMapping[index][2]
  let lat2 = robinsonMapping[index + 1][0]
  let X2 = robinsonMapping[index + 1][1]
  let Y2 = robinsonMapping[index + 1][2]
  const ratio = (abslat - lat1) / (lat2 - lat1)
  return {
    X: X1 + (X2 - X1) * ratio,
    Y: (Y1 + (Y2 - Y1) * ratio) * Math.sign(lat)
  }
}

/**
 * Transform latitude and longitude to Robinson projection
 * @notes
 * The mapping is given by the following formulas:
 * x = 0.8487 RX (λ - λ0)
 * y = 1.3523 RY
 * where RX and RY are the interpolated values from the Robinson mapping.
 * @param {number[]} coords Latitude and longitude
 * @returns {number[]} Transformed coordinates
 */
function transformCoords(coords) {

  const R = 180 / Math.PI

  let [lon, lat] = coords

  // if (lon > 180 + MERIDIAN) {
  //   lon = lon - 360
  // }
  // if (lon < MERIDIAN - 180) {
  //   lon = lon + 360
  // }

  // const { X, Y } = getInterpolateRobinsonParameters(lat)
  const { X, Y } = getRegressedRobinsonParameters(lat)
  const x = 0.8487 * R * X * (lon - MERIDIAN) / 180 * Math.PI
  const y = 1.3523 * R * Y
  // const x = coords[0]
  // const y = coords[1]
  return [
    x + 180,
    90 - y
  ]

}

/**
 * Get the SVG path content for an array of coordinates
 * @param {number[][]} coords Array of coordinates
 * @returns {string} SVG path content
 */
function getSvgPathContent(coords) {
  const pathData = coords.map(coord => transformCoords(coord).join(',')).join(' ')
  const svgContent = `<path d="M${pathData}" stroke="black" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-width="0.1"/>`
  return svgContent
}

// Get this data from https://www.naturalearthdata.com/
// const { features: coastlineFeatures } = await shapefile.read("./data/ne_110m_coastline.shp")
const { features: landFeatures } = await shapefile.read("./data/ne_110m_land.shp")
// const { features: landFeatures } = await shapefile.read("./data/ne_50m_land.shp")
// const { features: countryFeatures } = await shapefile.read("./data/ne_110m_admin_0_countries.shp")
// const { features: countryFeatures } = await shapefile.read("./data/ne_50m_admin_0_countries.shp")

// Initialize SVG
const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">`
let svgContent = ''

// for (let feature of coastlineFeatures) {
//   // If the feature type is LineString, add it to the SVG

//   if (feature.geometry.type === 'LineString') {
//     svgContent += getSvgPathContent(feature.geometry.coordinates)
//   } else {
//     console.log('Coastline: feature type not supported:', feature.geometry.type)
//     console.log(feature)
//   }
// }

for (let feature of landFeatures) {
  // If the feature type is LineString, add it to the SVG

  if (feature.geometry.type === 'Polygon') {
    for (let poly of feature.geometry.coordinates) {
      svgContent += getSvgPathContent(poly)
    }
  } else if (feature.geometry.type === 'MultiPolygon') {
    for (let poly of feature.geometry.coordinates) {
      for (let subpoly of poly) {
        svgContent += getSvgPathContent(subpoly)
      }
    }
  } else {
    console.log('Country: feature type not supported:', feature.geometry.type)
    console.log(feature)
  }
}

// for (let feature of countryFeatures) {
//   // If the feature type is LineString, add it to the SVG

//   if (feature.geometry.type === 'Polygon') {
//     for (let poly of feature.geometry.coordinates) {
//       svgContent += getSvgPathContent(poly)
//     }
//   } else if (feature.geometry.type === 'MultiPolygon') {
//     for (let poly of feature.geometry.coordinates) {
//       for (let subpoly of poly) {
//         svgContent += getSvgPathContent(subpoly)
//       }
//     }
//   } else {
//     console.log('Country: feature type not supported:', feature.geometry.type)
//     console.log(feature)
//   }
// }

// Draw border around whole map
const border = [
  [-180, -90],
  [180, -90]
]
for (let lat = -90; lat <= 90; lat += 1) {
  border.push([180, lat])
}
border.push([180, 90])
border.push([-180, 90])
for (let lat = 90; lat >= -90; lat -= 1) {
  border.push([-180, lat])
}
border.push([-180, -90])
svgContent += getSvgPathContent(border)

// Finish and output svg
const svgFooter = `</svg>`
const svg = svgHeader + svgContent + svgFooter


await fs.writeFile('./output.svg', svg)