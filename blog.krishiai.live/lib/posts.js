import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { supabase } from "./supabaseClient";

const postsDirectory = path.join(process.cwd(), "posts");


// Get all post slugs
export function getPostSlugs() {
  return fs.readdirSync(postsDirectory).map(file => file.replace(/\.md$/, ""));
}

// Get all posts
export async function getAllPosts() {
  // Try fetching from Supabase first if configured
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co') {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('published', true)
        .order('date', { ascending: false });

      if (!error && data) {
        return data.map(post => ({
          ...post,
          date: new Date(post.date).toISOString().split('T')[0]
        }));
      }
    } catch (err) {
      console.error('Error fetching posts from Supabase:', err);
    }
  }

  // Fallback to local files
  const slugs = getPostSlugs();
  const posts = await Promise.all(slugs.map(slug => getPostBySlug(slug)));
  // Sort by date descending
  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Get post data by slug
export async function getPostBySlug(slug) {
  // Try fetching from Supabase first
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co') {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!error && data) {
        return {
          ...data,
          date: new Date(data.date).toISOString().split('T')[0]
        };
      }
    } catch (err) {
      console.error(`Error fetching post ${slug} from Supabase:`, err);
    }
  }

  // Fallback to local files
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  const contentHtml = (await remark().use(html).process(content)).toString();
  return {
    slug,
    ...data,
    date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
    contentHtml,
  };
}
