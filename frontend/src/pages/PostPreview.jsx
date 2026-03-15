import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ExternalLink, Calendar } from 'lucide-react';

const PostPreview = () => {
    const { briefId } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const res = await axios.get(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/posts/${briefId}`
                );
                setPost(res.data);
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        fetchPost();
    }, [briefId]);

    if (loading) return (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
            <div style={{ color:'var(--text-secondary)', fontSize:'1.1rem' }}>⏳ Loading post...</div>
        </div>
    );

    if (!post) return (
        <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🤖</div>
            <h2>Post Still Generating...</h2>
            <p style={{ color:'var(--text-secondary)', marginTop:'0.5rem' }}>
                The AI agents are working on it. Check back in a few moments!
            </p>
            <Link to="/" style={{ display:'inline-block', marginTop:'1.5rem', color:'var(--accent-blue)', textDecoration:'none' }}>
                ← Back to Dashboard
            </Link>
        </div>
    );

    return (
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            {/* Back button */}
            <Link to="/analytics" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                color: 'var(--text-secondary)', marginBottom: '1.5rem',
                textDecoration: 'none', fontSize: '0.9rem',
                transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color='var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-secondary)'}>
                <ArrowLeft size={16} /> Back to Analytics
            </Link>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Hero image */}
                {post.featured_image_url && (
                    <div style={{ position: 'relative', height: '340px', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                        <img
                            src={post.featured_image_url}
                            alt={post.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => { e.target.parentElement.style.display='none'; }}
                        />
                        {/* Gradient overlay */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, transparent 40%, rgba(15,23,42,0.95) 100%)'
                        }} />
                        {/* Title over image */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem' }}>
                            <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.875rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.75rem' }}>
                                {post.title}
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <span className="badge published">SEO Score: {post.seo_score}%</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                                    <Calendar size={14} /> {new Date(post.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
                                </span>
                                {post.live_url && post.live_url.startsWith('http') && (
                                    <a href={post.live_url} target="_blank" rel="noopener noreferrer"
                                        style={{ color:'var(--accent-blue)', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:'0.35rem', textDecoration:'none' }}>
                                        <ExternalLink size={14} /> View on WordPress
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Post content */}
                <div style={{ padding: '2rem 2.5rem' }}>
                    {/* Title if no hero image */}
                    {!post.featured_image_url && (
                        <>
                            <span className="badge published" style={{ marginBottom: '1rem', display: 'inline-block' }}>
                                SEO Score: {post.seo_score}%
                            </span>
                            <h1 style={{ marginBottom: '1.5rem', fontSize: '1.875rem', lineHeight: '1.2' }}>{post.title}</h1>
                        </>
                    )}

                    {/* Blog body */}
                    <div
                        className="post-body"
                        dangerouslySetInnerHTML={{
                            __html: (post.html_content || '')
                                .replace(/<h1[^>]*>.*?<\/h1>/i, '')  // remove duplicate H1
                                .replace(/<figure[\s\S]*?<\/figure>/i, '') // remove embedded image (shown above)
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PostPreview;
