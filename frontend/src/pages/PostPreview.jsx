import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';

const PostPreview = () => {
    const { briefId } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const res = await axios.get(`http://localhost:8000/api/content/posts/${briefId}`);
                setPost(res.data);
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        fetchPost();
    }, [briefId]);

    if (loading) return <div className="card" style={{ margin: '2rem' }}>Loading...</div>;
    if (!post) return <div className="card" style={{ margin: '2rem' }}>Post not found. It might still be generating!</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '2rem auto', background: 'var(--bg-secondary)', padding: '3rem', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            <Link to="/analytics" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '2rem', textDecoration: 'none' }}>
                <ArrowLeft size={16} /> Back to Analytics
            </Link>
            {post.featured_image_url && <img src={post.featured_image_url} alt="Featured" style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '12px', marginBottom: '2rem' }} />}
            <span className="badge published" style={{ marginBottom: '1rem', display: 'inline-block' }}>SEO Rank: {post.seo_score}%</span>
            <h1 style={{ marginBottom: '1.5rem', fontSize: '2rem', lineHeight: '1.2' }}>{post.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: post.html_content }} style={{ lineHeight: '1.8', fontSize: '1.1rem' }} />
        </div>
    );
};

export default PostPreview;
