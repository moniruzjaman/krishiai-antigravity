import Head from 'next/head'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Head>
        <title>Agri Wisdom Blog</title>
        <meta name="description" content="Agriculture wisdom in Bangla" />
      </Head>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold">Welcome to Agri Wisdom</h1>
        <p>Agriculture knowledge and tips in Bangla and English.</p>
        <Link href="/blog" className="text-blue-500 hover:underline">Go to Blog</Link>
      </div>
    </>
  )
}