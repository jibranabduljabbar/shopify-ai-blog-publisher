export default function Home() {
  return <main>
    <nav><span className="brand">S<span className="dot">.</span></span><span>SIGMA WEB HUB</span><span className="badge">DEVELOPMENT DEMO</span></nav>
    <section className="hero"><p className="eyebrow">IDEAS INTO ARTICLES</p><h1>Build with <span>AI.</span></h1>
      <p className="intro">A small publishing engine for big ideas. From a developer-focused topic to a complete Shopify article, one scheduled step at a time.</p>
      <a className="button" href="https://sigma-ai-blog.myshopify.com/blogs/build-with-ai" target="_blank" rel="noreferrer">Visit the blog <span>↗</span></a>
      <p className="note">The development store requires its storefront password.</p>
    </section>
    <section className="flow" aria-label="Publishing workflow">
      {[['01', 'Choose a topic', 'Practical ideas for developers, rotated every week.'], ['02', 'Write with Gemini', 'Structured content with clear headings and useful examples.'], ['03', 'Check the content', 'Validate the response and clean the HTML before publishing.'], ['04', 'Publish to Shopify', 'An article, excerpt and tags in the Build with AI blog.']].map(([n, title, text]) => <article key={n}><span className="number">{n}</span><h2>{title}</h2><p>{text}</p></article>)}
    </section>
    <footer><p>Gemini + Next.js + Shopify</p><p>Weekly schedule configured · Monday, 08:00 UTC</p><small>This page describes the workflow. It does not report live connection or publishing status.</small></footer>
  </main>;
}
