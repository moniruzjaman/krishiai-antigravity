import Head from 'next/head';
import { getPostBySlug, getPostSlugs } from "../../lib/posts";

export default function BlogPost({ postData }) {
  return (
    <>
      <Head>
        <title>{postData.seo_title || postData.title}</title>
        <meta name="description" content={postData.seo_description} />
      </Head>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold">{postData.title}</h1>
        <p className="text-gray-500 my-2">
          {postData.date} | {postData.category}
        </p>
        <div dangerouslySetInnerHTML={{ __html: postData.contentHtml }} className="mt-4" />
      </div>
    </>
  );
}

export async function getStaticPaths() {
  const slugs = getPostSlugs();
  const paths = slugs.map(slug => ({ params: { slug } }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const postData = await getPostBySlug(params.slug);
  return { props: { postData } };
}