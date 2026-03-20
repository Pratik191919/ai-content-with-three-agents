import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ExternalLink, Calendar, Tag, ShieldCheck } from 'lucide-react';

const PostPreview = () => {
    const { briefId } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/content';

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const res = await axios.get(`${API_BASE}/posts`);
                const found = res.data.find(p => String(p.brief_id) === String(briefId) || String(p.id) === String(briefId));
                setPost(found);
            } catch (err) {
                console.error('Failed to fetch post', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [briefId, API_BASE]);

    if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading AI Content...</div>;
    
    if (!post) return (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
            <h2>Post Not Published Yet</h2>
            <p>Wait for Agent 02 to finish the writing process.</p>
            <Link to="/" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>Return to Dashboard</Link>
        </div>
    );

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '5rem' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                <ChevronLeft size={16} /> Back to Dashboard
            </Link>

            <header style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                    <span className="badge" style={{ background: 'var(--accent-purple)', color: 'white' }}>{post.category || 'General'}</span>
                    <span className="badge progress">SEO Score: {post.seo_score}%</span>
                </div>
                
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
                    {post.title}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14}/> {new Date(post.created_at).toLocaleDateString()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14}/> Agent Verifed</div>
                </div>
            </header>

            {/* Featured Image */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '3rem', borderRadius: '16px' }}>
                <img 
                  src={post.featured_image_url} 
                  alt={post.title} 
                  style={{ width: '100%', maxHeight: '500px', objectFit: 'cover' }}
                  onError={(e) => {
                      const seed = post.title.toLowerCase().replace(/[^a-z]/g, '').substring(0, 10);
                      e.target.src = `https://picsum.photos/seed/${seed}/1200/630`;
                      e.target.onerror = null;
                  }}
                />
            </div>

            {/* Gallery of Extra Content Images */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '3rem' }}>
                {[post.content_image, post.content_image_1, post.content_image_2]
                    .filter(img => img != null)
                    .filter((img, index, self) => self.indexOf(img) === index)
                    .slice(0, 2)
                    .map((imgUrl, i) => (
                        <div key={i} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <img src={imgUrl} alt="Content preview" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                        </div>
                    ))
                }
            </div>

            {/* Article Content */}
            <div 
              className="article-content" 
              style={{ fontSize: '1.1rem', lineHeight: 1.8, color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{ __html: post.html_content }}
            />

            {post.live_url && (
                <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>This post is live on WordPress</p>
                    <a 
                      href={post.live_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="theme-toggle"
                      style={{ width: 'auto', padding: '0 2rem', gap: '10px', borderRadius: '12px', background: 'var(--accent-blue)', color: 'white', border: 'none' }}
                    >
                        View Live Site <ExternalLink size={16} />
                    </a>
                </div>
            )}
        </div>
    );
};

export default PostPreview;
