import './globals.css'

export const metadata = {
  title: 'Pengadilan Agama Penajam - Website Resmi',
  description: 'Website resmi Pengadilan Agama Penajam Kelas I B, Kabupaten Penajam Paser Utara, Kalimantan Timur. Layanan peradilan agama yang cepat, sederhana, dan berbiaya ringan.',
  keywords: 'pengadilan agama, penajam, paser utara, kalimantan timur, perceraian, waris, hibah, wakaf',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
