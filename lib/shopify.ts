import type { Config } from "./config";
import type { ArticleContent } from "./content";
import { AppError } from "./errors";
import { requestJson } from "./http";

export type Blog = { id: string; handle: string; title: string };
export type Article = { id: string; handle: string; title: string; isPublished: boolean };

export class Shopify {
  private token = "";
  constructor(private config: Config) {}

  private async accessToken() {
    if (this.token) return this.token;
    if (this.config.SHOPIFY_ADMIN_ACCESS_TOKEN) return this.config.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const result = await requestJson<{ access_token?: string }>(`https://${this.config.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.config.SHOPIFY_CLIENT_ID, client_secret: this.config.SHOPIFY_CLIENT_SECRET })
    }, "Shopify authentication");
    if (!result.access_token) throw new AppError("SHOPIFY_AUTH_ERROR", "Shopify did not return an access token.");
    // One Shopify instance per run: weekly jobs always exchange a fresh token.
    this.token = result.access_token;
    return this.token;
  }

  private async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const token = await this.accessToken();
    const result = await requestJson<{ data?: T; errors?: unknown[] }>(`https://${this.config.SHOPIFY_STORE_DOMAIN}/admin/api/${this.config.SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables })
    }, "Shopify Admin API");
    if (result.errors?.length || !result.data) throw new AppError("SHOPIFY_GRAPHQL_ERROR", "Shopify rejected the query. Verify API version and read_content/write_content scopes.");
    return result.data;
  }

  async blog(): Promise<Blog> {
    if (this.config.SHOPIFY_BLOG_ID) {
      const raw = this.config.SHOPIFY_BLOG_ID;
      const id = raw.startsWith("gid:") ? raw : `gid://shopify/Blog/${raw}`;
      const data = await this.query<{ blog: Blog | null }>(`query Blog($id: ID!) { blog(id: $id) { id handle title } }`, { id });
      if (data.blog) return data.blog;
    } else {
      let after: string | null = null;
      // Paginate rather than assuming the destination is among the first blogs.
      for (let page = 0; page < 20; page++) {
        const data: { blogs: { nodes: Blog[]; pageInfo: { hasNextPage: boolean; endCursor: string } } } = await this.query(
          `query Blogs($after: String) { blogs(first: 100, after: $after) { nodes { id handle title } pageInfo { hasNextPage endCursor } } }`, { after });
        const blog = data.blogs.nodes.find(b => b.handle === this.config.SHOPIFY_BLOG_HANDLE);
        if (blog) return blog;
        if (!data.blogs.pageInfo.hasNextPage) break;
        after = data.blogs.pageInfo.endCursor;
      }
    }
    throw new AppError("BLOG_NOT_FOUND", "Destination blog not found. Check SHOPIFY_BLOG_HANDLE or SHOPIFY_BLOG_ID.", 404);
  }

  async existing(blog: Blog, handle: string): Promise<Article | null> {
    const numericId = blog.id.split("/").pop();
    const data = await this.query<{ articles: { nodes: (Article & { blog: { id: string } })[] } }>(
      `query Existing($query: String!) { articles(first: 20, query: $query) { nodes { id handle title isPublished blog { id } } } }`,
      { query: `blog_id:${numericId} AND handle:${handle}` });
    return data.articles.nodes.find(a => a.handle === handle && a.blog.id === blog.id) ?? null;
  }

  async create(blog: Blog, handle: string, content: ArticleContent): Promise<Article> {
    const data = await this.query<{ articleCreate: { article: Article | null; userErrors: { field: string[] | null; message: string }[] } }>(
      `mutation Publish($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle title isPublished } userErrors { field message } } }`,
      { article: { blogId: blog.id, handle, title: content.title, body: content.body_html, summary: content.summary,
        tags: content.tags, author: { name: this.config.BLOG_AUTHOR }, isPublished: this.config.PUBLISH_ARTICLES } });
    if (data.articleCreate.userErrors.length || !data.articleCreate.article) {
      const fields = data.articleCreate.userErrors.map(e => e.field?.join(".") ?? "article").join(", ");
      throw new AppError("SHOPIFY_ARTICLE_REJECTED", `Shopify rejected article fields: ${fields || "article"}. Check blog access and content.`);
    }
    return data.articleCreate.article;
  }

  url(blog: Blog, article: Article) {
    return `https://${this.config.SHOPIFY_STORE_DOMAIN}/blogs/${blog.handle}/${article.handle}`;
  }
}
