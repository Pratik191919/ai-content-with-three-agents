import React, { useState, useEffect } from 'react';
import { Target, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/content';

const Dashboard = () => {
    const [stats, setStats] = useState([
        { title: 'Briefs Generated', value: '...', icon: <Target className="stat-icon text-purple-500" /> },
        { title: 'Posts Published', value: '...', icon: <CheckCircle className="stat-icon text-green-500" /> },
        { title: 'Avg SEO Score', value: '...', icon: <TrendingUp className="stat-icon text-blue-500" /> },
        { title: 'Rewrite Queue', value: '...', icon: <AlertCircle className="stat-icon text-red-500" /> },
    ]);
    const [recentBriefs, setRecentBriefs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [briefsRes, postsRes, perfRes] = await Promise.all([
                    axios.get(`${API_BASE}/briefs`),
                    axios.get(`${API_BASE}/posts`),
                    axios.get(`${API_BASE}/performance`)
                ]);

                const briefs = briefsRes.data;
                const posts = postsRes.data;
                const perfs = perfRes.data;

                const avgSeo = posts.length > 0
                    ? Math.round(posts.reduce((acc, p) => acc + (p.seo_score || 0), 0) / posts.length)
                    : 0;

                const rewrites = perfs.filter(p => p.score < 60).length;

                setStats([
                    { title: 'Briefs Generated', value: briefs.length.toString(), icon: <Target className="stat-icon text-purple-500" /> },
                    { title: 'Posts Published', value: posts.length.toString(), icon: <CheckCircle className="stat-icon text-green-500" /> },
                    { title: 'Avg SEO Score', value: avgSeo.toString(), icon: <TrendingUp className="stat-icon text-blue-500" /> },
                    { title: 'Rewrite Queue', value: rewrites.toString(), icon: <AlertCircle className="stat-icon text-red-500" /> },
                ]);

                setRecentBriefs(briefs.slice(0, 5));
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
            <h1 style={{ marginBottom: '2rem', fontSize: '1.75rem', fontWeight: 700 }}>Overview Pipeline</h1>

            <div className="grid-cards">
                {stats.map((s, idx) => (
                    <div key={idx} className="card">
                        <div className="stat-title">{s.title}</div>
                        <div className="stat-value">
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="card">
                <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Recent Briefs</h2>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Keyword</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBriefs.map((b, i) => (
                                <tr key={b.id || i}>
                                    <td style={{ fontWeight: 500 }}>{b.title}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{b.target_keyword}</td>
                                    <td>
                                        <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {recentBriefs.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No briefs found. Run Agent 01.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
