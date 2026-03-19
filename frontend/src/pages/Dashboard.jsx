import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Layers, CheckCircle, TrendingUp } from 'lucide-react';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/content';

const Dashboard = () => {
    const getFeaturedImage = (post) => {
        if (post.featured_image_url && post.featured_image_url.startsWith('http') && !post.featured_image_url.includes('placeholder')) {
            return post.featured_image_url;
        }
        // Use a high-quality search-based fallback
        const seed = post.title.toLowerCase().replace(/[^a-z]/g, '').substring(0, 10);
        return `https://picsum.photos/seed/${seed}/1200/630`;
    };

    const [stats, setStats] = useState([
        { title: 'Briefs', icon: Layers, value: '—', color: 'var(--accent-purple)' },
        { title: 'Published', icon: CheckCircle, value: '—', color: 'var(--accent-green)' },
        { title: 'SEO Avg', icon: TrendingUp, value: '—', color: 'var(--accent-blue)' },
    ]);
    const [recentPosts, setRecentPosts] = useState([]);
    const [recentBriefs, setRecentBriefs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [briefsRes, postsRes, perfRes] = await Promise.all([
                    axios.get(`${API_BASE}/briefs`),
                    axios.get(`${API_BASE}/posts`),
                    axios.get(`${API_BASE}/performance`)
                ]);

                const briefs = Array.isArray(briefsRes.data) ? briefsRes.data : [];
                const posts = Array.isArray(postsRes.data) ? postsRes.data : [];
                const perfs = Array.isArray(perfRes.data) ? perfRes.data : [];

                const avgSeo = posts.length > 0
                    ? Math.round(posts.reduce((acc, p) => acc + (p.seo_score || 0), 0) / posts.length)
                    : 0;

                setStats([
                    { title: 'Briefs Generated', icon: Layers, value: briefs.length, color: 'var(--accent-purple)' },
                    { title: 'Posts Published', icon: CheckCircle, value: posts.length, color: 'var(--accent-green)' },
                    { title: 'Avg SEO Score', icon: TrendingUp, value: `${avgSeo}%`, color: 'var(--accent-blue)' },
                ]);

                setRecentPosts(posts.slice(0, 6));
                setRecentBriefs(briefs.slice(0, 4));
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard">
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Pipeline Overview</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Welcome back to your AI Content Hub.</p>
            </header>

            {/* Stat Cards */}
            <div className="grid-cards" style={{ marginBottom: '2.5rem' }}>
                {stats.map((s, i) => (
                    <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="stat-title">{s.title}</div>
                            <s.icon size={18} style={{ color: s.color, opacity: 0.8 }} />
                        </div>
                        <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.5rem' }}>
                            <div style={{ width: '70%', height: '100%', background: s.color, borderRadius: '2px' }} />
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Published Posts Grid */}
                <section>
                    <h2 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>🖼️ Recent Content</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
                        {recentPosts.map((post, i) => (
                            <div key={post.id || i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ height: '140px', background: 'var(--bg-app)', position: 'relative' }}>
                                    <img 
                                        src={getFeaturedImage(post)} 
                                        alt="" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        onError={(e) => {
                                            const seed = post.title.toLowerCase().replace(/[^a-z]/g, '').substring(0, 10);
                                            e.target.src = `https://picsum.photos/seed/${seed}/1200/630`;
                                            e.target.onerror = null; // Prevent infinite loops
                                        }}
                                    />
                                    <span className="badge published" style={{ position: 'absolute', top: '10px', right: '10px' }}>
                                        SEO {post.seo_score}%
                                    </span>
                                </div>
                                <div style={{ padding: '1rem' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', lineHeight: 1.4 }}>{post.title}</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{post.category || 'General'}</span>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Link to={`/preview/${post.brief_id || post.id}`} style={{ color: 'var(--accent-purple)' }} title="Preview locally">
                                                <Layers size={14} />
                                            </Link>
                                            {post.live_url && (
                                                <a href={post.live_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }} title="View on WordPress">
                                                    <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Recent Briefs Table */}
                <section>
                    <h2 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>📋 Briefs Queue</h2>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBriefs.map((b, i) => (
                                    <tr key={b.id || i}>
                                        <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{b.title}</td>
                                        <td><span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
