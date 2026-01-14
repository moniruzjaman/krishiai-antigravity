import Link from "next/link";
import { getAllPosts } from "../../lib/posts";

export default function BlogList({ posts }) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Blog</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {posts.map(post => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="block p-4 shadow rounded hover:bg-gray-50">
            <h2 className="text-xl font-semibold">{post.title}</h2>
            <p className="text-gray-500">{post.date} | {post.category}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const posts = await getAllPosts();
  return { props: { posts } };
}