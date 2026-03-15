// ============================================================
// Template Library
// Starter templates for common app types
// ============================================================

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: "saas" | "ecommerce" | "dashboard" | "portfolio" | "social" | "utility";
  suggestedFrameworks: string[];
  planDescription: string;
}

export const templates: AppTemplate[] = [
  {
    id: "saas-landing",
    name: "SaaS Landing Page",
    description: "Modern landing page with hero, features, pricing, testimonials, and CTA",
    category: "saas",
    suggestedFrameworks: ["nextjs", "react", "svelte"],
    planDescription: `Build a modern SaaS landing page with:
- Hero section with headline, subheadline, and CTA button
- Features grid (6 features with icons and descriptions)
- Pricing table (3 tiers: Free, Pro, Enterprise)
- Testimonials carousel with real-looking customer quotes
- FAQ accordion section
- Footer with newsletter signup, social links, and legal pages
- Fully responsive (mobile, tablet, desktop)
- Dark/light mode toggle
- Smooth scroll navigation
- Animated sections on scroll`,
  },
  {
    id: "dashboard",
    name: "Admin Dashboard",
    description: "Full-featured admin dashboard with charts, tables, and sidebar navigation",
    category: "dashboard",
    suggestedFrameworks: ["nextjs", "react", "vue"],
    planDescription: `Build an admin dashboard with:
- Sidebar navigation with collapsible sections
- Top bar with search, notifications, and user avatar
- Overview page with KPI cards (revenue, users, orders, growth)
- Charts section (line chart for revenue, bar chart for users, pie chart for categories)
- Data table with sorting, filtering, pagination, and search
- User management page (list, create, edit, delete users)
- Settings page with profile, notifications, and security tabs
- Responsive layout (sidebar collapses to hamburger on mobile)
- Dark/light mode
- Loading skeletons for all data sections`,
  },
  {
    id: "ecommerce",
    name: "E-Commerce Store",
    description: "Product catalog with cart, checkout, and order management",
    category: "ecommerce",
    suggestedFrameworks: ["nextjs", "vue", "svelte"],
    planDescription: `Build an e-commerce store with:
- Product listing page with grid/list view toggle
- Product filters (category, price range, rating, in stock)
- Product detail page with image gallery, sizes, add to cart
- Shopping cart with quantity controls and price calculation
- Checkout flow (shipping info, payment placeholder, order summary)
- Order confirmation page
- Search with autocomplete
- Category pages
- Responsive design (mobile-first)
- Wishlist functionality`,
  },
  {
    id: "portfolio",
    name: "Developer Portfolio",
    description: "Personal portfolio with projects, blog, and contact form",
    category: "portfolio",
    suggestedFrameworks: ["nextjs", "svelte", "react"],
    planDescription: `Build a developer portfolio with:
- Hero section with name, title, and animated intro
- About section with skills and experience timeline
- Projects grid with live preview links and GitHub links
- Blog section with markdown-rendered posts
- Contact form with validation
- Resume/CV download button
- Social links (GitHub, LinkedIn, Twitter)
- Dark/light mode
- Smooth page transitions
- SEO optimized`,
  },
  {
    id: "social-feed",
    name: "Social Feed App",
    description: "Social media feed with posts, comments, likes, and user profiles",
    category: "social",
    suggestedFrameworks: ["nextjs", "react", "vue"],
    planDescription: `Build a social feed app with:
- Feed page with infinite scroll
- Post creation with text, images (drag & drop)
- Like, comment, and share functionality on each post
- Comment threads with nested replies
- User profile pages with avatar, bio, and post history
- Follow/unfollow other users
- Notification dropdown
- Search users and posts
- Responsive design
- Loading states and empty states`,
  },
  {
    id: "task-manager",
    name: "Task Manager (Kanban)",
    description: "Kanban board with drag-and-drop, labels, due dates, and team assignment",
    category: "utility",
    suggestedFrameworks: ["nextjs", "react", "vue"],
    planDescription: `Build a Kanban task manager with:
- Board view with columns (To Do, In Progress, Review, Done)
- Drag and drop cards between columns
- Card detail modal with title, description, labels, due date, assignee
- Create, edit, and delete cards
- Filter by label, assignee, or due date
- Multiple boards (switch between projects)
- Board settings (rename, reorder columns, archive)
- Responsive (columns stack on mobile)
- Keyboard shortcuts (n = new card, / = search)
- Activity log per card`,
  },
  {
    id: "chat-app",
    name: "Real-Time Chat",
    description: "Chat application with channels, DMs, and message history",
    category: "social",
    suggestedFrameworks: ["nextjs", "react", "svelte"],
    planDescription: `Build a chat application with:
- Channel list sidebar with search
- Message thread with timestamps and avatars
- Message input with emoji picker and file attachments
- Create new channels (public and private)
- Direct messages between users
- User presence indicators (online, away, offline)
- Message reactions (emoji)
- Unread message badges
- Responsive design (sidebar slides on mobile)
- Typing indicators`,
  },
  {
    id: "blog-cms",
    name: "Blog with CMS",
    description: "Blog platform with rich text editor, categories, and SEO",
    category: "utility",
    suggestedFrameworks: ["nextjs", "vue", "django"],
    planDescription: `Build a blog platform with:
- Public blog listing with featured post hero
- Category and tag filtering
- Individual post page with rich content, table of contents, reading time
- Admin dashboard for managing posts
- Rich text editor (WYSIWYG) for creating/editing posts
- Image upload and management
- SEO fields per post (title, description, OG image)
- Comment system on posts
- RSS feed generation
- Responsive design
- Search functionality`,
  },
];

export function getTemplate(id: string): AppTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function listTemplates(): AppTemplate[] {
  return templates;
}

export function listTemplatesByCategory(category: string): AppTemplate[] {
  return templates.filter((t) => t.category === category);
}
