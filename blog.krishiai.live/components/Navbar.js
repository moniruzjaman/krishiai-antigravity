export default function Navbar() {
  return (
    <nav className="bg-green-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Agri Wisdom</h1>
        <div>
          <a href="/" className="mr-4 hover:underline">Home</a>
          <a href="/blog" className="hover:underline">Blog</a>
        </div>
      </div>
    </nav>
  )
}