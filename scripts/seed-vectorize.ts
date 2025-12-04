/**
 * Vectorize Seeding Script
 * Populates vector indexes with initial knowledge base
 * Phase 4: Vectorize Setup
 *
 * Run with: npx wrangler dev --test-scheduled --x-local-protocol https
 * Then trigger: curl http://localhost:8787/__scheduled
 */

import { VectorizeService } from '../src/server/services/VectorizeService';
import type { DocumentChunk } from '../src/server/services/VectorizeService';

/**
 * Profile data extracted from web scrub report
 */
const PROFILE_DATA = {
  personal: {
    name: 'De Havilland Fox',
    aliases: ['RainbowKillah', 'RainbowSmoke', 'djfox8705'],
    title: 'System & Network Engineer',
    location: 'Washington, DC',
    bio: 'Washington D.C. native, gay, very blunt, into technology. Tech architect, gamer on a mission, dancer at heart.',
    communities: ['#TeamFemBoys', '#TeamSCORPIO', '#TeamDemiBoys', '#TeamVers', '#RainbowSmoke'],
    interests: ['technology', 'gaming', 'dance', 'content creation', 'streaming']
  },
  social: {
    github: 'rainbowkillah',
    twitter: '@RainbowKillah',
    linkedin: 'dehavillandfox',
    websites: [
      'rainbowsmokeofficial.com',
      'rnbwsmk.live',
      'mrrainbowsmoke.com',
      'foxtechnologies.org',
      'rainbowkillah.wordpress.com'
    ],
    platforms: ['TikTok', 'Twitch', 'YouTube', 'Facebook', 'Instagram', 'Snapchat', 'Vimeo', 'Behance']
  },
  gaming: {
    platforms: ['Twitch', 'YouTube'],
    games: ['Apex Legends', 'Valorant', 'Call of Duty'],
    schedule: 'Monday-Friday 7-11 PM EST',
    style: 'High-energy gameplay and community engagement'
  },
  tech: {
    expertise: [
      'Full-stack developer specializing in Cloudflare Workers',
      'Experience with React, TypeScript, Node.js',
      'Interested in AI/ML, serverless architecture, edge computing',
      'Writes technical blogs about web development',
      'Microsoft TechCommunity contributor'
    ]
  }
};

/**
 * Generate profile documents for embedding
 */
function generateProfileDocuments(): DocumentChunk[] {
  const documents: DocumentChunk[] = [];

  // Personal profile
  documents.push({
    id: 'profile-personal',
    text: `${PROFILE_DATA.personal.name}, also known as ${PROFILE_DATA.personal.aliases.join(', ')}, is a ${PROFILE_DATA.personal.title} based in ${PROFILE_DATA.personal.location}. ${PROFILE_DATA.personal.bio} Part of communities: ${PROFILE_DATA.personal.communities.join(', ')}. Interests include: ${PROFILE_DATA.personal.interests.join(', ')}.`,
    metadata: {
      type: 'bio',
      category: 'profile',
      section: 'personal'
    }
  });

  // Gaming profile
  documents.push({
    id: 'profile-gaming',
    text: `RainbowSmoke is a streamer on ${PROFILE_DATA.gaming.platforms.join(' and ')}. Plays ${PROFILE_DATA.gaming.games.join(', ')}. Streaming schedule: ${PROFILE_DATA.gaming.schedule}. Known for ${PROFILE_DATA.gaming.style}.`,
    metadata: {
      type: 'gaming',
      category: 'profile',
      section: 'gaming'
    }
  });

  // Tech profile
  documents.push({
    id: 'profile-tech',
    text: `Tech expertise: ${PROFILE_DATA.tech.expertise.join('. ')}.`,
    metadata: {
      type: 'tech',
      category: 'profile',
      section: 'technology'
    }
  });

  // Social media
  documents.push({
    id: 'profile-social',
    text: `Find RainbowSmoke on GitHub (${PROFILE_DATA.social.github}), Twitter/X (${PROFILE_DATA.social.twitter}), LinkedIn (${PROFILE_DATA.social.linkedin}), and platforms: ${PROFILE_DATA.social.platforms.join(', ')}. Main websites: ${PROFILE_DATA.social.websites.join(', ')}.`,
    metadata: {
      type: 'social',
      category: 'profile',
      section: 'social_media'
    }
  });

  return documents;
}

/**
 * Generate content documents (FAQ, guides, etc.)
 */
function generateContentDocuments(): DocumentChunk[] {
  const documents: DocumentChunk[] = [];

  // FAQ: Streaming
  documents.push({
    id: 'faq-streaming',
    text: 'Q: Is RainbowSmoke streaming right now? A: Check Twitch and YouTube for live status. Regular streaming schedule is Monday-Friday from 7-11 PM EST. Stream notifications are available on Twitter/X @RainbowKillah.',
    metadata: {
      type: 'faq',
      category: 'content',
      topic: 'streaming'
    }
  });

  // FAQ: Contact
  documents.push({
    id: 'faq-contact',
    text: 'Q: How can I contact RainbowSmoke? A: Use the chat feature on rainbowsmokeofficial.com or send a DM on Twitter/X @RainbowKillah. For business inquiries, visit the contact page on rainbowsmokeofficial.com.',
    metadata: {
      type: 'faq',
      category: 'content',
      topic: 'contact'
    }
  });

  // FAQ: Gaming
  documents.push({
    id: 'faq-gaming',
    text: 'Q: What games does RainbowSmoke play? A: Primarily FPS games including Apex Legends, Valorant, and Call of Duty. Sometimes tries new games based on community suggestions. High-energy gameplay with community interaction.',
    metadata: {
      type: 'faq',
      category: 'content',
      topic: 'gaming'
    }
  });

  // FAQ: Tech work
  documents.push({
    id: 'faq-tech',
    text: 'Q: What technology does RainbowSmoke work with? A: Specializes in Cloudflare Workers, React, TypeScript, and Node.js. Interested in AI/ML, serverless architecture, and edge computing. Contributes to Microsoft TechCommunity and writes technical blogs.',
    metadata: {
      type: 'faq',
      category: 'content',
      topic: 'technology'
    }
  });

  // About website
  documents.push({
    id: 'content-website',
    text: 'rainbowsmokeofficial.com is the official website for RainbowSmoke (De Havilland Fox). Features an AI-powered chat assistant, gallery, streaming schedule, and contact information. Built with Cloudflare Workers and features real-time AI chat with streaming responses.',
    metadata: {
      type: 'about',
      category: 'content',
      topic: 'website',
      url: 'https://rainbowsmokeofficial.com'
    }
  });

  // Tech projects
  documents.push({
    id: 'content-projects',
    text: 'RainbowSmoke works on various tech projects including AI-powered chat systems using Cloudflare Workers AI, real-time WebSocket applications with Durable Objects, and edge computing solutions. Projects are often documented on GitHub (rainbowkillah) and technical blogs.',
    metadata: {
      type: 'projects',
      category: 'content',
      topic: 'technology'
    }
  });

  return documents;
}

/**
 * Generate product/service documents
 */
function generateProductDocuments(): DocumentChunk[] {
  const documents: DocumentChunk[] = [];

  // AI Chat Service
  documents.push({
    id: 'product-ai-chat',
    text: 'AI-powered chat assistant on rainbowsmokeofficial.com. Features real-time streaming responses, conversation history, multi-model support (free Llama 3.3 and premium GPT-4o/Claude), and context awareness. Built with Cloudflare Workers AI and AI Gateway.',
    metadata: {
      type: 'service',
      category: 'products',
      name: 'AI Chat Assistant',
      technology: 'Cloudflare Workers AI'
    }
  });

  // Streaming Content
  documents.push({
    id: 'product-streaming',
    text: 'Live gaming streams on Twitch and YouTube. High-energy FPS gameplay with community interaction. Schedule: Monday-Friday 7-11 PM EST. Features viewer engagement, chat interaction, and skill development in Apex Legends, Valorant, and Call of Duty.',
    metadata: {
      type: 'service',
      category: 'products',
      name: 'Gaming Streams',
      platforms: 'Twitch, YouTube'
    }
  });

  // Tech Consulting
  documents.push({
    id: 'product-consulting',
    text: 'System & Network Engineering expertise available for consulting. Specializes in Cloudflare Workers, serverless architecture, edge computing, React/TypeScript applications, and AI/ML integration. Contact via rainbowsmokeofficial.com for business inquiries.',
    metadata: {
      type: 'service',
      category: 'products',
      name: 'Tech Consulting'
    }
  });

  return documents;
}

/**
 * Main seeding function
 */
export async function seedVectorize(env: Env): Promise<void> {
  console.log('🌱 Starting Vectorize seeding...');

  try {
    // Initialize VectorizeService
    const vectorService = new VectorizeService(
      env.AI,
      env.VECTORIZE_PROFILE,
      env.VECTORIZE_CONTENT,
      env.VECTORIZE_PRODUCTS,
      env.EMBEDDING_MODEL
    );

    // Test connections
    console.log('Testing index connections...');
    const [profileOk, contentOk, productsOk] = await Promise.all([
      vectorService.testConnection('profile'),
      vectorService.testConnection('content'),
      vectorService.testConnection('products')
    ]);

    if (!profileOk || !contentOk || !productsOk) {
      throw new Error('One or more indexes failed connection test');
    }

    console.log('✓ All indexes connected successfully');

    // Generate documents
    const profileDocs = generateProfileDocuments();
    const contentDocs = generateContentDocuments();
    const productDocs = generateProductDocuments();

    console.log(`Generated ${profileDocs.length} profile documents`);
    console.log(`Generated ${contentDocs.length} content documents`);
    console.log(`Generated ${productDocs.length} product documents`);

    // Seed profile index
    console.log('Seeding profile index...');
    await vectorService.upsertDocuments('profile', profileDocs);
    console.log(`✓ Seeded ${profileDocs.length} profile documents`);

    // Seed content index
    console.log('Seeding content index...');
    await vectorService.upsertDocuments('content', contentDocs);
    console.log(`✓ Seeded ${contentDocs.length} content documents`);

    // Seed products index
    console.log('Seeding products index...');
    await vectorService.upsertDocuments('products', productDocs);
    console.log(`✓ Seeded ${productDocs.length} product documents`);

    console.log('🎉 Vectorize seeding complete!');
    console.log(`Total documents: ${profileDocs.length + contentDocs.length + productDocs.length}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Export for scheduled trigger or manual execution
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    await seedVectorize(env);
  }
};
