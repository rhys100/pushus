import { readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const distAssets = join(process.cwd(), 'dist', 'assets')

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`
}

function gzipSize(buffer) {
  return gzipSync(buffer).length
}

const files = readdirSync(distAssets)
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map((name) => {
    const path = join(distAssets, name)
    const raw = readFileSync(path)
    const size = statSync(path).size
    const gz = gzipSize(raw)
    return { name, size, gz }
  })
  .sort((a, b) => b.size - a.size)

const total = files.reduce((sum, file) => sum + file.size, 0)
const totalGz = files.reduce((sum, file) => sum + file.gz, 0)

console.log('PushUS bundle stats\n')
console.log(`${'File'.padEnd(44)} ${'Raw'.padStart(10)} ${'Gzip'.padStart(10)}`)
console.log('-'.repeat(66))

for (const file of files) {
  console.log(
    `${file.name.padEnd(44)} ${formatKb(file.size).padStart(10)} ${formatKb(file.gz).padStart(10)}`,
  )
}

console.log('-'.repeat(66))
console.log(`${'TOTAL'.padEnd(44)} ${formatKb(total).padStart(10)} ${formatKb(totalGz).padStart(10)}`)

const main = files.find((file) => file.name.startsWith('index-') && file.size > 100_000)
const today = files.find((file) => file.name.startsWith('TodayPage-'))

if (main) {
  console.log(`\nMain chunk: ${main.name} (${formatKb(main.gz)} gzip)`)
}
if (today) {
  console.log(`Today chunk: ${today.name} (${formatKb(today.gz)} gzip)`)
}
