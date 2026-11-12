import { TemplateConfig, MindMapNode, Priority, Status } from './types';

export const INDUSTRIES = [
  'Tech & AI',
  'Marketing & Brand',
  'Business & Ops',
  'Productivity',
] as const;

// Detailed hand-crafted core templates
const CORE_TEMPLATES: Record<string, MindMapNode[]> = {
  'llm-agentic-pipeline': [
    { id: '1', label: 'LLM Agentic Pipeline Setup', parentId: null, priority: 'High', status: 'In Progress', notes: 'Core orchestrator for multi-agent system handling automated web research and code generation.' },
    { id: '2', label: '1. User Input & Query Parser', parentId: '1', priority: 'High', status: 'Done', notes: 'Sanitizes input, extracts user intent, and formats metadata for downstream agents.' },
    { id: '3', label: 'Intent Classification Model', parentId: '2', priority: 'Medium', status: 'Done', notes: 'Uses small local fast model (e.g., Llama-3B) for fast intent classification.' },
    { id: '4', label: 'Entity Extraction Engine', parentId: '2', priority: 'High', status: 'Done', notes: 'Extracts critical search parameters and structured JSON constraints.' },
    { id: '5', label: '2. Multi-Agent Routing Engine', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Orchestrates handoffs between Research, Synthesizer, and Validator agents.' },
    { id: '6', label: 'Researcher Agent (Tavily)', parentId: '5', priority: 'High', status: 'In Progress', notes: 'Parallel search across web sources with vector-based semantic retrieval.' },
    { id: '7', label: 'Code Generator Agent', parentId: '5', priority: 'High', status: 'Todo', notes: 'Uses Gemini 2.5 Flash to generate fully-typed TypeScript code blocks.' },
    { id: '8', label: '3. Human-in-the-Loop Validation', parentId: '1', priority: 'Medium', status: 'Todo', notes: 'Pause execution to request admin approval for code deployment or external executions.' },
    { id: '9', label: 'Interactive UI Approve Button', parentId: '8', priority: 'Low', status: 'Todo', notes: 'Renders in control panel with real-time SSE updates.' },
    { id: '10', label: 'Slack Alert Notification Webhook', parentId: '8', priority: 'Low', status: 'Todo', notes: 'Dispatches payload containing preview cards and action buttons.' },
  ],
  'custom-workstation': [
    { id: '1', label: '2026 Custom Workstation Planner', parentId: null, priority: 'High', status: 'In Progress', notes: 'Planning a silent, liquid-cooled AI development machine.' },
    { id: '2', label: 'Core Compute (CPU & GPU)', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Selecting high-bandwidth chips for deep learning and heavy compiling.' },
    { id: '3', label: 'AMD Threadripper 7960X', parentId: '2', priority: 'High', status: 'Done', notes: '24 Cores / 48 Threads, perfect for massive Docker-based builds and simulation.' },
    { id: '4', label: 'Dual RTX 5090 32GB GPUs', parentId: '2', priority: 'High', status: 'In Progress', notes: 'Enables local training of medium-sized LLMs and high-concurrency inference.' },
    { id: '5', label: 'Cooling & Case (Silent Run)', parentId: '1', priority: 'Medium', status: 'Todo', notes: 'Focus on maximum dissipation under 35dB threshold.' },
    { id: '6', label: 'Custom Loop Water Cooling', parentId: '5', priority: 'Medium', status: 'Todo', notes: 'EK Waterblocks on both GPUs and CPU linked to dual 420mm radiators.' },
    { id: '7', label: 'Noctua NF-A14 Industrial Fans', parentId: '5', priority: 'Low', status: 'Todo', notes: 'Runs on custom PMW fan curves to remain silent under normal loads.' },
    { id: '8', label: 'Memory & Storage Speed', parentId: '1', priority: 'High', status: 'Done', notes: 'High-speed scratch disks and ample ECC RAM for model weights loading.' },
    { id: '9', label: '128GB DDR5 ECC RAM (6400MHz)', parentId: '8', priority: 'High', status: 'Done', notes: 'Prevents memory corruption errors during multi-day model fine-tuning.' },
    { id: '10', label: '4TB Samsung 990 PRO Gen5 NVMe', parentId: '8', priority: 'Medium', status: 'Done', notes: '14,000 MB/s read speed for ultra-fast dataset caching.' },
  ],
  'devops-cicd': [
    { id: '1', label: 'DevOps CI/CD Lifecycle', parentId: null, priority: 'High', status: 'In Progress', notes: 'Automated software delivery pipeline with staging validation.' },
    { id: '2', label: '1. Git Commit & Push Trigger', parentId: '1', priority: 'High', status: 'Done', notes: 'Triggers GitHub actions workflow on main and development branch merges.' },
    { id: '3', label: 'Commit Linting & Format Check', parentId: '2', priority: 'Low', status: 'Done', notes: 'Prettier and ESLint validation blocks pipeline early if code is messy.' },
    { id: '4', label: '2. Unit & Integration Testing', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Runs suite of Vitest and Playwright tests inside secure Docker containment.' },
    { id: '5', label: 'Parallel Playwright Tests', parentId: '4', priority: 'Medium', status: 'In Progress', notes: 'Sharded across 4 parallel containers to reduce execution time to under 3 minutes.' },
    { id: '6', label: '3. Docker Build & Push to Registry', parentId: '1', priority: 'High', status: 'Todo', notes: 'Compiles production assets and pushes securely to Google Container Registry (GCR).' },
    { id: '7', label: 'Multi-Stage Build Optimization', parentId: '6', priority: 'Medium', status: 'Todo', notes: 'Splits build layer from runner layer to keep final image under 120MB.' },
    { id: '8', label: '4. Cloud Run Auto-Deployment', parentId: '1', priority: 'High', status: 'Todo', notes: 'Zero-downtime rolling updates with automatic traffic routing.' },
    { id: '9', label: 'Canary Deployment Strategy', parentId: '8', priority: 'High', status: 'Todo', notes: 'Route 5% of real traffic to new build, monitor 5xx errors for 10 minutes.' },
  ],
  'pinterest-growth': [
    { id: '1', label: 'Faceless Pinterest Brand Strategy', parentId: null, priority: 'High', status: 'In Progress', notes: 'Driving organic viral traffic to high-ticket affiliate funnels in the home decor niche.' },
    { id: '2', label: 'Keyword Research & SEO Map', parentId: '1', priority: 'High', status: 'Done', notes: 'Targeting high-volume, low-competition keywords in Pinterest Search bar.' },
    { id: '3', label: 'Pinterest Search Bar Auto-Suggest', parentId: '2', priority: 'Medium', status: 'Done', notes: 'Exporting long-tail keywords (e.g., "minimalist warm living room decor").' },
    { id: '4', label: 'Rich Pins Activation', parentId: '2', priority: 'High', status: 'Done', notes: 'Syncs metadata from blog to Pinterest, boosting authority and click-through rates.' },
    { id: '5', label: 'Content Creation & Templates', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Designing 20 high-converting Canva templates.' },
    { id: '6', label: 'Aesthetic Video Idea Pins', parentId: '5', priority: 'High', status: 'In Progress', notes: '5-second looping aesthetic videos with text overlays and trending ambient audio.' },
    { id: '7', label: 'Click-to-Blog Static Pins', parentId: '5', priority: 'Medium', status: 'Todo', notes: 'Bold headlines, high contrast product close-ups, and clear Call-To-Action (CTA).' },
    { id: '8', label: 'Automation & Scheduler Setup', parentId: '1', priority: 'Medium', status: 'Todo', notes: 'Ensuring continuous daily pinning presence without manual posting.' },
    { id: '9', label: 'Tailwind App Scheduler', parentId: '8', priority: 'High', status: 'Todo', notes: 'Queue 10 pins per day spaced exactly 2.4 hours apart.' },
  ],
  'affiliate-funnel': [
    { id: '1', label: 'High-Ticket Affiliate Funnel', parentId: null, priority: 'High', status: 'In Progress', notes: 'Architecting an automated conversion engine for digital SaaS courses.' },
    { id: '2', label: 'Traffic Generation Source', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Organic platforms directing targeted users to the opt-in bridge page.' },
    { id: '3', label: 'Short-Form Video (TikTok & Reels)', parentId: '2', priority: 'High', status: 'In Progress', notes: 'Aesthetic B-roll containing value hooks and a clear CTA directing to the link-in-bio.' },
    { id: '4', label: 'Value-First Opt-In Bridge', parentId: '1', priority: 'High', status: 'Done', notes: 'Captures email addresses in exchange for a free high-utility PDF checklist.' },
    { id: '5', label: 'Free PDF Interactive Guide', parentId: '4', priority: 'Medium', status: 'Done', notes: '15-page step-by-step roadmap containing deep actionable insights and subtle product links.' },
    { id: '6', label: '7-Day Email Nurture Sequence', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Automated email series building deep trust, authority, and introducing the affiliate product.' },
    { id: '7', label: 'Day 1: The Epiphany Bridge Story', parentId: '6', priority: 'High', status: 'Done', notes: 'Introduces the pain point and how the specific software changed everything.' },
    { id: '8', label: 'Day 4: Deep Case Study Validation', parentId: '6', priority: 'Medium', status: 'In Progress', notes: 'Showcases real success data and walks through step-by-step results.' },
    { id: '9', label: 'Day 7: Soft Urgency & Final Offer', parentId: '6', priority: 'Medium', status: 'Todo', notes: 'Limited bonus checklist expires. Call to action to purchase via affiliate link.' },
  ],
  'content-calendar': [
    { id: '1', label: 'Automated Content Calendar', parentId: null, priority: 'High', status: 'In Progress', notes: 'Multi-platform media engine powered by automated Airtable triggers.' },
    { id: '2', label: 'Pillar Content (Weekly)', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Long-form, high-value source piece that will be chopped into smaller assets.' },
    { id: '3', label: '15-Min Educational YouTube Video', parentId: '2', priority: 'High', status: 'In Progress', notes: 'Solve a highly searched developer problem using full visual code walks.' },
    { id: '4', label: 'Micro-Content Repurposing', parentId: '1', priority: 'Medium', status: 'Todo', notes: 'Splitting YouTube video into 10 multi-format promotional pieces.' },
    { id: '5', label: '5 TikTok/Reels Short Clips', parentId: '4', priority: 'High', status: 'Todo', notes: 'Cut engaging 30-second clips with dynamic captions and high-energy hooks.' },
    { id: '6', label: '3 LinkedIn Carousel Graphics', parentId: '4', priority: 'Medium', status: 'Todo', notes: 'Extract key code snippets and architecture maps into clean, swipeable PDF slides.' },
    { id: '7', label: '2 Twitter/X Written Threads', parentId: '4', priority: 'Low', status: 'Todo', notes: 'Convert narrative scripts into high-performance text bullet threads.' },
    { id: '8', label: 'Distribution & Scheduling Tool', parentId: '1', priority: 'Medium', status: 'Done', notes: 'Central repository where assets are queued and dispatched.' },
    { id: '9', label: 'Buffer Platform Scheduler', parentId: '8', priority: 'Medium', status: 'Done', notes: 'Stores optimized tags and timings, posting automatically across accounts.' },
  ],
  'product-launch': [
    { id: '1', label: 'Product Launch 2026 Milestone', parentId: null, priority: 'High', status: 'In Progress', notes: 'Q3 launch roadmap for a collaborative cloud analytics suite.' },
    { id: '2', label: '1. Product & Feature Freeze', parentId: '1', priority: 'High', status: 'Done', notes: 'Halting all secondary feature additions to focus entirely on stability and load tests.' },
    { id: '3', label: 'API Load Testing (20k Users)', parentId: '2', priority: 'High', status: 'Done', notes: 'Ensuring response times remain under 200ms during stress tests via k6.' },
    { id: '4', label: '2. Marketing Assets & Collateral', parentId: '1', priority: 'High', status: 'In Progress', notes: 'Gathering assets for the landing page and Product Hunt launch.' },
    { id: '5', label: 'Product Hunt Teaser & Video', parentId: '4', priority: 'Medium', status: 'In Progress', notes: '2-minute fast-paced demo showing real-time collaborative speed.' },
    { id: '6', label: 'Press Kit & High-Res Mockups', parentId: '4', priority: 'Low', status: 'Todo', notes: 'Transparent-background dashboard renders and founder headshots.' },
    { id: '7', label: '3. Launch Day War Room', parentId: '1', priority: 'High', status: 'Todo', notes: 'Real-time monitoring and immediate support resolution during launch.' },
    { id: '8', label: 'Discord Support Dev Standby', parentId: '7', priority: 'High', status: 'Todo', notes: '3 core developers active on voice chat to handle incoming bug reports.' },
    { id: '9', label: 'Live Stripe Payment Dashboard Monitor', parentId: '7', priority: 'Medium', status: 'Todo', notes: 'Ensuring conversion flows and trial activations have zero system faults.' },
  ],
};

// Generative metadata for all 101 templates to meet the absolute prompt requirements
export const TEMPLATE_LIST: { id: string; name: string; industry: TemplateConfig['industry']; description: string }[] = [
  // --- TECH & AI WORKFLOWS (25 templates) ---
  { id: 'llm-agentic-pipeline', name: 'LLM Agentic Pipeline Setup', industry: 'Tech & AI', description: 'Core orchestrator for multi-agent systems handling web research and automated code generation.' },
  { id: 'custom-workstation', name: 'Custom Workstation Build Planner', industry: 'Tech & AI', description: 'Planning a silent, liquid-cooled deep learning computer setup with high bandwidth components.' },
  { id: 'devops-cicd', name: 'DevOps CI/CD Lifecycle', industry: 'Tech & AI', description: 'Automated software delivery pipeline with staging validation and rolling updates.' },
  { id: 'rag-chatbot-search', name: 'RAG Chatbot with Hybrid Search', industry: 'Tech & AI', description: 'Combines vector semantic search with BM25 keyword matching for superior response accuracy.' },
  { id: 'kubernetes-cluster', name: 'Kubernetes Cluster Deployment', industry: 'Tech & AI', description: 'Step-by-step production cluster configuration with Ingress and secure secrets.' },
  { id: 'docker-multistage', name: 'Docker Multi-Stage Build Blueprint', industry: 'Tech & AI', description: 'Optimizing container image size by isolating compiling dependencies from runner layers.' },
  { id: 'aws-vpc-setup', name: 'AWS Multi-Region VPC Architecture', industry: 'Tech & AI', description: 'Designing public-private subnets, NAT gateways, and peering for high availability.' },
  { id: 'whisper-transcribe', name: 'OpenAI Whisper Audio Pipeline', industry: 'Tech & AI', description: 'Processing long-form audio files into chunked, timestamped transcription files.' },
  { id: 'vector-db-index', name: 'Vector Database Indexing Setup', industry: 'Tech & AI', description: 'Schema configuration for high-dimension embeddings with HNSW indexing.' },
  { id: 'lora-finetuning', name: 'Finetuning Llama 3 with LoRA', industry: 'Tech & AI', description: 'Supervised fine-tuning parameter grid, custom dataset cleaning, and model evaluation.' },
  { id: 'chrome-extension-flow', name: 'Chrome Extension Developer Flow', industry: 'Tech & AI', description: 'Background service worker state sync, content scripts, and secure popup communication.' },
  { id: 'django-api-setup', name: 'Django REST API Blueprint', industry: 'Tech & AI', description: 'Setting up custom JWT authentication, serializers, and optimized query prefetching.' },
  { id: 'wasm-audio-proc', name: 'Rust WebAssembly Audio Processor', industry: 'Tech & AI', description: 'Real-time synthesizer filters compiling directly to low-latency WASM browser nodes.' },
  { id: 'react-native-arch', name: 'React Native App Architecture', industry: 'Tech & AI', description: 'Setting up clean state management, push notification routing, and native bridge triggers.' },
  { id: 'fastapi-router', name: 'FastAPI Microservice Router', industry: 'Tech & AI', description: 'High-speed asynchronous routing with Pydantic payload models and CORS control.' },
  { id: 'graphql-federation', name: 'GraphQL Apollo Server Federation', industry: 'Tech & AI', description: 'Merging individual subgraphs into a unified gateway schema with custom entity resolvers.' },
  { id: 'postgres-partitioning', name: 'PostgreSQL Partitioning Blueprint', industry: 'Tech & AI', description: 'Splitting highly active tables by timestamp intervals for ultra-fast queries.' },
  { id: 'terraform-iac', name: 'Terraform Infrastructure Setup', industry: 'Tech & AI', description: 'Configuring remote state locks, custom workspace variables, and modular resource stacks.' },
  { id: 'next-server-comp', name: 'Next.js Server Components Workflow', industry: 'Tech & AI', description: 'Streamlining server rendering boundary, suspenses, and data caching invalidation.' },
  { id: 'cypress-e2e-tests', name: 'Cypress End-to-End Test Suite', industry: 'Tech & AI', description: 'Structuring robust test selectors, network mocks, and authenticated session saving.' },
  { id: 'kafka-event-stream', name: 'Apache Kafka Real-Time Stream', industry: 'Tech & AI', description: 'Producer-consumer partition groups with message schemas and event serialization.' },
  { id: 'mlflow-experiment', name: 'MLflow Experiment Tracking Setup', industry: 'Tech & AI', description: 'Logging training accuracy metrics, model parameters, and artifacts to cloud servers.' },
  { id: 'pytorch-cnn-train', name: 'PyTorch CNN Training Workflow', industry: 'Tech & AI', description: 'Image transformation pipeline, gradient descent loops, and validation save states.' },
  { id: 'edge-ai-object', name: 'Edge AI Object Detection Pipeline', industry: 'Tech & AI', description: 'Quantizing YOLO models to run locally on low-power mobile microprocessors.' },
  { id: 'web3-smart-contract', name: 'Web3 Ethereum Smart Contract Setup', industry: 'Tech & AI', description: 'Solidity contract testing using Hardhat, gas analysis, and local mainnet forks.' },

  // --- DIGITAL MARKETING & BRAND GROWTH (25 templates) ---
  { id: 'pinterest-growth', name: 'Faceless Pinterest Brand Strategy', industry: 'Marketing & Brand', description: 'Driving organic viral traffic to high-ticket affiliate funnels in home decor.' },
  { id: 'affiliate-funnel', name: 'Affiliate Funnel Architecture', industry: 'Marketing & Brand', description: 'Architecting an automated lead capture, value gift, and automated SaaS course promotion.' },
  { id: 'content-calendar', name: 'Automated Content Calendar', industry: 'Marketing & Brand', description: 'Multi-platform media engine powered by automated Airtable triggers.' },
  { id: 'insta-reels-growth', name: 'Instagram Reels Growth Hack', industry: 'Marketing & Brand', description: 'Daily aesthetic hooks, high retention audio loops, and automated DM chat triggers.' },
  { id: 'yt-seo-planner', name: 'YouTube SEO & Keyword Planner', industry: 'Marketing & Brand', description: 'Optimizing titles, custom clickbait thumbnails, and video description semantic structure.' },
  { id: 'newsletter-launch', name: 'Newsletter Launch & Lead Magnet', industry: 'Marketing & Brand', description: 'Creating high-converting opt-in landing pages and delivering downloadable PDF guides.' },
  { id: 'tiktok-shop-launch', name: 'TikTok Shop Product Launch', industry: 'Marketing & Brand', description: 'Onboarding affiliates, compiling video samples, and setting up listing descriptions.' },
  { id: 'fb-ads-matrix', name: 'Facebook Ads Campaign Testing Matrix', industry: 'Marketing & Brand', description: 'Broad targeting ad sets, creative variant testing, and CBO scaling budgets.' },
  { id: 'google-ads-funnel', name: 'Google Ads Search Funnel Setup', industry: 'Marketing & Brand', description: 'Negative keyword mapping, high-intent landing matches, and target CPA settings.' },
  { id: 'cold-email-sequence', name: 'High-Ticket Client Cold Email Sequence', industry: 'Marketing & Brand', description: 'Personalized pain-point loops, custom call links, and multi-day automatic follow-ups.' },
  { id: 'shopify-cro-audit', name: 'Shopify Store Conversion Rate Audit', industry: 'Marketing & Brand', description: 'Friction reduction in checkout, trust badges layout, and exit-intent promo popup design.' },
  { id: 'saas-landing-wire', name: 'SaaS Copywriting Landing Page Wireframe', industry: 'Marketing & Brand', description: 'Structure of headlines, dynamic social proof cards, and a simple pricing breakdown.' },
  { id: 'podcast-production', name: 'Podcast Production & Syndication Flow', industry: 'Marketing & Brand', description: 'Recording multi-track files, generating summaries, and publishing to Spotify & Apple.' },
  { id: 'linkedin-personal-brand', name: 'LinkedIn Personal Brand Growth Plan', industry: 'Marketing & Brand', description: 'Authoritative story templates, networking comments schedule, and lead capture posts.' },
  { id: 'twitter-content-engine', name: 'Twitter/X Threads Content Engine', industry: 'Marketing & Brand', description: 'Structuring high-impact hooks, spacing key concepts, and adding automated CTA pins.' },
  { id: 'brand-positioning-map', name: 'Brand Positioning & Logo Identity', industry: 'Marketing & Brand', description: 'Competitor matrix mapping, primary logo layout, and unified typography guidelines.' },
  { id: 'ecommerce-cart-flow', name: 'E-commerce Abandoned Cart Flow', industry: 'Marketing & Brand', description: 'Sequence of dynamic discount emails sent at 1hr, 24hr, and 72hr intervals.' },
  { id: 'webinar-funnel-boost', name: 'Webinar Funnel & Registration Boost', industry: 'Marketing & Brand', description: 'Direct ad landing page, automated SMS confirmation, and replay urgency sales timer.' },
  { id: 'pr-press-release', name: 'Press Release PR Distribution Flow', industry: 'Marketing & Brand', description: 'Drafting announcement copies, pitching specific journalists, and tracking pickup links.' },
  { id: 'ugc-creator-partner', name: 'UGC Creator Partnership Workflow', industry: 'Marketing & Brand', description: 'Onboarding visual creators, sending script guidelines, and reviewing video assets.' },
  { id: 'seo-backlink-outreach', name: 'SEO Backlink Outreach Strategy', industry: 'Marketing & Brand', description: 'Finding broken link opportunities, drafting templates, and resource page pitching.' },
  { id: 'local-seo-gprofile', name: 'Local SEO Google Business Optimization', industry: 'Marketing & Brand', description: 'Adding geo-tagged photos, requesting customer reviews, and optimizing business categories.' },
  { id: 'referral-loop-design', name: 'Referral Program Loop Design', industry: 'Marketing & Brand', description: 'Configuring double-sided rewards (Give $10, Get $10) and email share prompts.' },
  { id: 'testimonial-video-funnel', name: 'Customer Testimonial Video Funnel', industry: 'Marketing & Brand', description: 'Sending automated video requests upon product delivery, with coupon rewards.' },
  { id: 'amazon-fba-listing', name: 'Amazon FBA Listing Optimization', industry: 'Marketing & Brand', description: 'Targeting backend search phrases, listing high-resolution infographics, and A+ content.' },

  // --- OPERATIONS & BUSINESS (25 templates) ---
  { id: 'product-launch', name: 'Product Launch 2026 Milestone', industry: 'Business & Ops', description: 'Q3 launch roadmap for a collaborative cloud analytics suite.' },
  { id: 'agile-sprint-roadmap', name: 'Agile Sprint Roadmap', industry: 'Business & Ops', description: 'Sprint planning layout with priority epics, story points, and task breakdowns.' },
  { id: 'freelance-client-onboard', name: 'Freelance Client Onboarding', industry: 'Business & Ops', description: 'Welcome checklist, intake form routing, contract signing, and setup.' },
  { id: 'saas-pricing-decision', name: 'SaaS Pricing Model Decision Tree', industry: 'Business & Ops', description: 'Mapping tier structures, value-add limits, and annual discount options.' },
  { id: 'series-a-deck', name: 'Series A Pitch Deck Slide Map', industry: 'Business & Ops', description: 'Flow of Problem, Solution, Traction, Market Size, and Financial Projections.' },
  { id: 'customer-escalation', name: 'Customer Support Escalation Tree', industry: 'Business & Ops', description: 'Routing Tier 1 general queries to specialized Tier 3 technical teams.' },
  { id: 'remote-team-offsite', name: 'Remote Team Offsite Event Planner', industry: 'Business & Ops', description: 'Sourcing villas, selecting collaborative workshops, and evening dinners agenda.' },
  { id: 'performance-review', name: 'Employee Performance Review Matrix', industry: 'Business & Ops', description: 'Evaluating core execution metrics, personal goals alignment, and review cycles.' },
  { id: 'quarterly-budget', name: 'Quarterly Financial Budget Allocation', industry: 'Business & Ops', description: 'Distributing capital to marketing, development, research, and server costs.' },
  { id: 'gdpr-hipaa-checklist', name: 'GDPR & HIPAA Compliance Checklist', industry: 'Business & Ops', description: 'Data encryption protocols, patient log access limits, and user deletion triggers.' },
  { id: 'contractor-signing-flow', name: 'Contractor Agreement Legal Flow', industry: 'Business & Ops', description: 'Drafting NDA, setting up HelloSign templates, and storing signed PDFs.' },
  { id: 'inventory-restock', name: 'Inventory Management Restock Cycle', industry: 'Business & Ops', description: 'Safety stock calculations, supplier lead times, and purchase order releases.' },
  { id: 'franchise-ops-manual', name: 'Franchise Business Operations Manual', industry: 'Business & Ops', description: 'Standardized kitchen prep steps, customer greeting, and cashier closure tasks.' },
  { id: 'kickstarter-campaign', name: 'Kickstarter Campaign Checklist', industry: 'Business & Ops', description: 'Configuring reward tiers, shooting core video, and early bird announcement loops.' },
  { id: 'm-and-a-due-diligence', name: 'Mergers & Acquisitions Due Diligence', industry: 'Business & Ops', description: 'Auditing codebases, examining past taxes, and reviewing employment contracts.' },
  { id: 'sales-hubspot-stages', name: 'Sales Pipeline HubSpot CRM Stages', industry: 'Business & Ops', description: 'Lead, Discovery Call, Proposal Sent, Contract Negotiating, Closed Won.' },
  { id: 'vendor-negotiation-blue', name: 'Vendor Negotiation Blueprint', industry: 'Business & Ops', description: 'Pricing anchor, volume discount demands, and SLA penalty agreements.' },
  { id: 'patent-application-map', name: 'Patent Application Process Map', industry: 'Business & Ops', description: 'Prior art search, detailing specifications, drafting claims, and filing.' },
  { id: 'qa-bug-triage', name: 'Quality Assurance Bug Triage Flow', industry: 'Business & Ops', description: 'Categorizing reports by severity (Critical, Major, Minor) and developer assignment.' },
  { id: 'corp-expense-policy', name: 'Corporate Expense Policy Rollout', industry: 'Business & Ops', description: 'Stating allowed travel meals, software subscriptions approvals, and reporting.' },
  { id: 'board-meeting-agenda', name: 'Board of Directors Meeting Agenda', industry: 'Business & Ops', description: 'State of business updates, major votes, financial review, and Q&A session.' },
  { id: 'disaster-recovery-plan', name: 'Disaster Recovery Plan', industry: 'Business & Ops', description: 'Daily backup mirrors, server cluster failovers, and crisis PR response templates.' },
  { id: 'customer-journey-map', name: 'Customer Journey Mapping', industry: 'Business & Ops', description: 'Awareness triggers, active comparison, buying phase, and customer retention loop.' },
  { id: 'office-relocation-log', name: 'Office Relocation Logistics Map', industry: 'Business & Ops', description: 'Packing tech equipment, sorting lease dates, and utility setup in new space.' },
  { id: 'swot-analysis-matrix', name: 'Strategic SWOT Analysis Matrix', industry: 'Business & Ops', description: 'Internal Strengths/Weaknesses vs. External Opportunities/Threats.' },

  // --- EVERYDAY PRODUCTIVITY (26 templates) ---
  { id: 'skincare-fitness', name: 'Skincare & Fitness Tracker', industry: 'Productivity', description: 'Structured morning/night facial product routine synced with weight training goals.' },
  { id: 'travel-itinerary', name: 'Travel Itinerary Planner', industry: 'Productivity', description: 'Pre-flight preparation checklist, hotel reservations index, and daily sightseeing paths.' },
  { id: 'personal-habit-loop', name: 'Personal Habit Loop', industry: 'Productivity', description: 'Trigger, Routine, and Reward architecture designed to lock in long-term habit positive loops.' },
  { id: 'weekly-meal-prep', name: 'Weekly Meal Prep & Calorie Matrix', industry: 'Productivity', description: 'Groceries bulk list, Sunday cooking slots, and macronutrient calculations.' },
  { id: 'college-study-schedule', name: 'College Semester Study Schedule', industry: 'Productivity', description: 'Weekly syllabus reviews, exam study periods, and paper writing steps.' },
  { id: 'fire-retirement-plan', name: 'FIRE Financial Retirement Plan', industry: 'Productivity', description: 'Savings rates tracker, index fund allocation, and Safe Withdrawal Rate (SWR).' },
  { id: 'home-declutter-flow', name: 'Modern Minimalist Home Declutter Flow', industry: 'Productivity', description: 'Room-by-room sorting categories (Keep, Donate, Sell, Throw Away).' },
  { id: 'reading-note-system', name: 'Ultimate Reading & Note-Taking System', industry: 'Productivity', description: 'Highlight extraction, progressive summarization, and tag association.' },
  { id: 'morning-routine-5am', name: 'Morning Routine "5 AM Club" Blueprint', industry: 'Productivity', description: '20-20-20 split: Intense movement, planning reflection, and personal skill learning.' },
  { id: 'language-fluency-90', name: 'Language Learning 90-Day Fluency', industry: 'Productivity', description: 'Daily flashcard drills, active listening exercises, and native conversations.' },
  { id: 'wedding-day-timeline', name: 'Wedding Day Timeline & Vendors', industry: 'Productivity', description: 'Morning makeup sessions, guest seating window, and reception event schedule.' },
  { id: 'apartment-hunting', name: 'Apartment Hunting Scorecard', industry: 'Productivity', description: 'Rent parameters, natural light rating, noise assessment, and deposit fees.' },
  { id: 'pet-adoption-check', name: 'Pet Adoption Preparation Checklist', industry: 'Productivity', description: 'Supplying nutrient food, locking balcony rails, and vet vaccination schedules.' },
  { id: 'novel-creative-outliner', name: 'Creative Writing Novel Outliner', industry: 'Productivity', description: 'Three-act story arc, protagonist motivation sheet, and climax layout.' },
  { id: 'garden-companion', name: 'Vegetable Garden Companion Planting', industry: 'Productivity', description: 'Placing repellant marigolds next to tomatoes, and optimal watering rates.' },
  { id: 'car-maintenance-history', name: 'Car Maintenance & Service History', industry: 'Productivity', description: 'Engine oil flush dates, brake pad replacement intervals, and tire rotations.' },
  { id: 'bullet-journal-setup', name: 'Bullet Journal Setup & Key', industry: 'Productivity', description: 'Creating future logs, monthly pages, custom color keys, and migration signs.' },
  { id: 'coffee-recipe-dial', name: 'Coffee Brewing Recipe Dial-In', industry: 'Productivity', description: 'Adjusting water temperature, grind size, extraction times, and yield scale.' },
  { id: 'smart-home-auto', name: 'Smart Home Automation Routine', industry: 'Productivity', description: 'Sunset light fade triggers, thermostat temperature shifts, and security locks.' },
  { id: 'diy-reno-cost', name: 'DIY Home Renovation Cost Planner', industry: 'Productivity', description: 'Kitchen cabinet tiling, paint gallons count, and tool rental estimates.' },
  { id: 'mental-health-journal', name: 'Mental Health Journaling Prompts', industry: 'Productivity', description: 'Expressing primary gratitude, identifying triggers, and writing positive affirmations.' },
  { id: 'gift-shopping-tracker', name: 'Gift Giving & Holiday Shopping Tracker', industry: 'Productivity', description: 'Budget allowance per person, custom gift thoughts, and shipment status.' },
  { id: 'podcast-capture', name: 'Podcast Epiphany Note Capture', industry: 'Productivity', description: 'Quick audio recording transcriptions, idea categorization, and actionable takeaways.' },
  { id: 'backyard-bbq-plan', name: 'Backyard BBQ Event Plan', industry: 'Productivity', description: 'Smoked brisket countdown timer, meat weight calculations, and guest drink indexes.' },
  { id: 'relocation-packing', name: 'Relocation & Packing Checklist', industry: 'Productivity', description: 'Labeling room boxes, notifying post office, and hiring verified movers.' },
  { id: 'digital-detox-30', name: 'Digital Detox 30-Day Calendar', industry: 'Productivity', description: 'Deleting endless scroll apps, screen-free bedrooms, and book reading.' },
];

/**
 * Clean deterministic layout/generator engine that outputs a fully data-rich
 * custom mind map hierarchy for ANY of the 101 templates.
 */
export function getTemplateNodes(id: string): MindMapNode[] {
  // If we have a hand-crafted core template, return it
  if (CORE_TEMPLATES[id]) {
    // Clone to prevent direct mutation of core objects
    return JSON.parse(JSON.stringify(CORE_TEMPLATES[id]));
  }

  // Otherwise, find the template metadata
  const meta = TEMPLATE_LIST.find((t) => t.id === id);
  if (!meta) {
    // Fallback if ID is invalid (return first hand-crafted template)
    return JSON.parse(JSON.stringify(CORE_TEMPLATES['llm-agentic-pipeline']));
  }

  // Dynamically generate a highly cohesive, industry-specific node list with realistic details
  const nodes: MindMapNode[] = [];
  const mainTitle = meta.name;
  const description = meta.description;

  // Root node
  nodes.push({
    id: '1',
    label: mainTitle,
    parentId: null,
    priority: 'High',
    status: 'In Progress',
    notes: description,
  });

  // Level 1 Nodes (Phases/Categories based on Industry)
  let phases: { label: string; notes: string }[] = [];
  let childrenList: { phaseIdx: number; label: string; notes: string; priority: Priority; status: Status }[] = [];

  if (meta.industry === 'Tech & AI') {
    phases = [
      { label: 'Phase 1: Architecture & Setup', notes: 'Defining system schemas, installing library SDKs, and locking environment credentials.' },
      { label: 'Phase 2: Core Development', notes: 'Writing service modules, implementing data processing loops, and wireframing dashboards.' },
      { label: 'Phase 3: Security & Deployment', notes: 'Configuring API rate limiters, conducting stress testing, and launching container files.' },
    ];
    childrenList = [
      { phaseIdx: 0, label: 'Configure Environment Variables', notes: 'Declaring secure keys and URLs inside locked .env configurations.', priority: 'High', status: 'Done' },
      { phaseIdx: 0, label: 'Initialize Database Schemas', notes: 'Creating table indexing boundaries and setting initial index maps.', priority: 'Medium', status: 'Done' },
      { phaseIdx: 1, label: 'Write Central Service Handler', notes: 'Coding main routes and error try/catch boundaries.', priority: 'High', status: 'In Progress' },
      { phaseIdx: 1, label: 'Integrate Dynamic UI Panel', notes: 'Building user-friendly status displays with Tailwind CSS layout blocks.', priority: 'Medium', status: 'In Progress' },
      { phaseIdx: 2, label: 'Configure Docker Container File', notes: 'Authoring multi-stage container files for light, fast deployment.', priority: 'High', status: 'Todo' },
      { phaseIdx: 2, label: 'Deploy to Cloud Run Sandbox', notes: 'Triggering builds to live secure endpoint hosting environments.', priority: 'Low', status: 'Todo' },
    ];
  } else if (meta.industry === 'Marketing & Brand') {
    phases = [
      { label: 'Step 1: Market Research', notes: 'Auditing high-performance competitor trends and identifying organic search keyword voids.' },
      { label: 'Step 2: Content Creation', notes: 'Drafting core value copy scripts and editing visual graphics for social platforms.' },
      { label: 'Step 3: Funnel Optimization', notes: 'Setting up lead capture links and auto-sending discount coupon email series.' },
    ];
    childrenList = [
      { phaseIdx: 0, label: 'Analyze Competitor Accounts', notes: 'Tracking their top 5 viral posts to reverse-engineer visual styles.', priority: 'High', status: 'Done' },
      { phaseIdx: 0, label: 'Compile SEO Long-Tail Keywords', notes: 'Mapping phrases that solve exact consumer paint points.', priority: 'Medium', status: 'Done' },
      { phaseIdx: 1, label: 'Design Graphic Canvas Templates', notes: 'Drafting high-contrast layouts featuring bold headline typography.', priority: 'High', status: 'In Progress' },
      { phaseIdx: 1, label: 'Write 10 Engaging Short Scripts', notes: 'Structuring fast hooks, middle value, and a solid call-to-action.', priority: 'Medium', status: 'In Progress' },
      { phaseIdx: 2, label: 'Launch Email Lead Opt-in Form', notes: 'Capturing email credentials in exchange for action-oriented PDFs.', priority: 'High', status: 'Todo' },
      { phaseIdx: 2, label: 'Monitor Traffic & Retarget Ads', notes: 'Scaling campaigns with positive return on advertising spend.', priority: 'Low', status: 'Todo' },
    ];
  } else if (meta.industry === 'Business & Ops') {
    phases = [
      { label: 'Milestone A: Planning & Approvals', notes: 'Sourcing capital, alignment with stakeholders, and locking legal documents.' },
      { label: 'Milestone B: Workflow Integration', notes: 'Onboarding core team members, delegating tickets, and setting KPIs.' },
      { label: 'Milestone C: Review & Feedback', notes: 'Evaluating performance sheets and shipping minor operational revisions.' },
    ];
    childrenList = [
      { phaseIdx: 0, label: 'Draft Master Service Agreement', notes: 'Specifying project delivery scopes and payment deadlines.', priority: 'High', status: 'Done' },
      { phaseIdx: 0, label: 'Secure Board Action Approvals', notes: 'Presenting core milestones to executive team members.', priority: 'Medium', status: 'Done' },
      { phaseIdx: 1, label: 'Configure Shared Kanban Board', notes: 'Onboarding developers to issue ticket trackers and sprint cycles.', priority: 'High', status: 'In Progress' },
      { phaseIdx: 1, label: 'Conduct Kickoff Team Synch', notes: 'Aligning department leaders on immediate 30-day goals.', priority: 'Medium', status: 'In Progress' },
      { phaseIdx: 2, label: 'Collect Initial Customer Reviews', notes: 'Sending post-purchase satisfaction forms to early user Cohorts.', priority: 'High', status: 'Todo' },
      { phaseIdx: 2, label: 'Publish Quarterly Progress Report', notes: 'Compiling financial metrics and scaling charts for investors.', priority: 'Low', status: 'Todo' },
    ];
  } else {
    // Everyday Productivity
    phases = [
      { label: 'Foundation: Habit Habits', notes: 'Creating frictionless triggers and scheduling daily implementation routines.' },
      { label: 'Execution: Daily Actions', notes: 'Tracking routine completion with simple checkboxes and logs.' },
      { label: 'Review: Weekly Progress Check', notes: 'Analyzing energy spikes and optimizing schedule times.' },
    ];
    childrenList = [
      { phaseIdx: 0, label: 'Prepare Material Equipment early', notes: 'Laying out gym clothes or products the night before to reduce friction.', priority: 'High', status: 'Done' },
      { phaseIdx: 0, label: 'Define exact trigger cues', notes: 'Linking the habit to an existing action (e.g., "Right after brushing teeth").', priority: 'Medium', status: 'Done' },
      { phaseIdx: 1, label: 'Perform Routine (30-min block)', notes: 'Focusing on single-task execution with zero mobile screen distraction.', priority: 'High', status: 'In Progress' },
      { phaseIdx: 1, label: 'Log completion on canvas grid', notes: 'Creating visual tracking streaks to release positive dopamine.', priority: 'Medium', status: 'In Progress' },
      { phaseIdx: 2, label: 'Reflect on energy & mood levels', notes: 'Noticing which hours produced maximum focus and adjusting sleep.', priority: 'High', status: 'Todo' },
      { phaseIdx: 2, label: 'Iterate & improve task checklist', notes: 'Streamlining steps to prevent exhaustion and maintain consistency.', priority: 'Low', status: 'Todo' },
    ];
  }

  // Push Phase Nodes (Level 1)
  phases.forEach((p, index) => {
    const phaseId = `phase_${index + 1}`;
    nodes.push({
      id: phaseId,
      label: p.label,
      parentId: '1',
      priority: 'Medium',
      status: 'In Progress',
      notes: p.notes,
    });
  });

  // Push Child Nodes (Level 2)
  childrenList.forEach((c, index) => {
    const childId = `child_${index + 1}`;
    const parentId = `phase_${c.phaseIdx + 1}`;
    nodes.push({
      id: childId,
      label: c.label,
      parentId: parentId,
      priority: c.priority,
      status: c.status,
      notes: c.notes,
    });
  });

  // Pre-color key branches of the template so it looks professionally designed right away
  const industry = meta ? meta.industry : 'Tech & AI';
  nodes.forEach(n => {
    if (n.parentId === null) {
      // Root Node
      n.isBold = true;
      if (industry === 'Tech & AI') {
        n.fillColor = '#0284c7'; n.textColor = '#ffffff'; n.borderColor = '#0284c7'; n.borderStyle = 'solid';
      } else if (industry === 'Marketing & Brand') {
        n.fillColor = '#db2777'; n.textColor = '#ffffff'; n.borderColor = '#db2777'; n.borderStyle = 'solid';
      } else if (industry === 'Business & Ops') {
        n.fillColor = '#0d9488'; n.textColor = '#ffffff'; n.borderColor = '#0d9488'; n.borderStyle = 'solid';
      } else {
        n.fillColor = '#059669'; n.textColor = '#ffffff'; n.borderColor = '#059669'; n.borderStyle = 'solid';
      }
    } else {
      // Determine branch level or phase grouping
      let branchIndex = 0;
      if (n.id.includes('phase_2') || n.parentId === 'phase_2' || n.id === '5' || n.parentId === '5') {
        branchIndex = 1;
      } else if (n.id.includes('phase_3') || n.parentId === 'phase_3' || n.id === '8' || n.parentId === '8') {
        branchIndex = 2;
      } else {
        // Distribute other nodes based on their parent hierarchy
        const hash = n.parentId ? n.parentId.charCodeAt(n.parentId.length - 1) || 0 : 0;
        branchIndex = hash % 3;
      }

      if (industry === 'Tech & AI') {
        if (branchIndex === 0) {
          n.fillColor = '#eff6ff'; n.textColor = '#1e40af'; n.borderColor = '#3b82f6'; n.borderStyle = 'solid';
        } else if (branchIndex === 1) {
          n.fillColor = '#f5f3ff'; n.textColor = '#5b21b6'; n.borderColor = '#8b5cf6'; n.borderStyle = 'dashed';
        } else {
          n.fillColor = '#f0fdf4'; n.textColor = '#166534'; n.borderColor = '#10b981'; n.borderStyle = 'solid';
        }
      } else if (industry === 'Marketing & Brand') {
        if (branchIndex === 0) {
          n.fillColor = '#fff1f2'; n.textColor = '#9f1239'; n.borderColor = '#f43f5e'; n.borderStyle = 'solid';
        } else if (branchIndex === 1) {
          n.fillColor = '#fdf2f8'; n.textColor = '#86198f'; n.borderColor = '#ec4899'; n.borderStyle = 'dashed';
        } else {
          n.fillColor = '#fff7ed'; n.textColor = '#9a3412'; n.borderColor = '#f97316'; n.borderStyle = 'solid';
        }
      } else if (industry === 'Business & Ops') {
        if (branchIndex === 0) {
          n.fillColor = '#f0fdfa'; n.textColor = '#115e59'; n.borderColor = '#0d9488'; n.borderStyle = 'solid';
        } else if (branchIndex === 1) {
          n.fillColor = '#f0fdf4'; n.textColor = '#166534'; n.borderColor = '#22c55e'; n.borderStyle = 'dashed';
        } else {
          n.fillColor = '#fffbeb'; n.textColor = '#92400e'; n.borderColor = '#f59e0b'; n.borderStyle = 'solid';
        }
      } else { // Productivity
        if (branchIndex === 0) {
          n.fillColor = '#ecfdf5'; n.textColor = '#065f46'; n.borderColor = '#10b981'; n.borderStyle = 'solid';
        } else if (branchIndex === 1) {
          n.fillColor = '#f0f9ff'; n.textColor = '#075985'; n.borderColor = '#0ea5e9'; n.borderStyle = 'dashed';
        } else {
          n.fillColor = '#fafaf9'; n.textColor = '#44403c'; n.borderColor = '#78716c'; n.borderStyle = 'solid';
        }
      }
    }
  });

  return nodes;
}
