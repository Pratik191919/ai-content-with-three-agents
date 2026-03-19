import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Activity, AlertCircle, CheckCircle2, Info, RefreshCcw, Filter } from 'lucide-react';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterAgent, setFilterAgent] = useState('All Agents');
    const [filterType, setFilterType] = useState('All Types');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/content/logs`);
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 20000);
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchAgent = filterAgent === 'All Agents' || log.agent_name.includes(filterAgent.split(' ')[0]);
            const matchType = filterType === 'All Types' || log.event_type === filterType;
            return matchAgent && matchType;
        });
    }, [logs, filterAgent, filterType]);

    const getStatusIcon = (type) => {
        switch (type) {
            case 'ERROR': return <AlertCircle className="text-red" size={18} />;
            case 'SUCCESS': return <CheckCircle2 className="text-green" size={18} />;
            default: return <Info className="text-blue" size={18} />;
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>System Activity</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track automated agent activity and error reports.</p>
                </div>
                <button 
                  onClick={fetchLogs} 
                  disabled={loading}
                  className="theme-toggle"
                  style={{ borderRadius: '12px', width: 'auto', padding: '0 1rem', gap: '8px' }}
                >
                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </header>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Filter size={18} style={{ color: 'var(--text-secondary)' }} />
                <select 
                  value={filterAgent} 
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="theme-toggle" 
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '0.4rem 1rem', width: '200px' }}
                >
                    <option>All Agents</option>
                    <option>Strategist</option>
                    <option>Writer</option>
                    <option>Auditor</option>
                </select>

                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="theme-toggle" 
                  style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '0.4rem 1rem', width: '200px' }}
                >
                    <option>All Types</option>
                    <option>SUCCESS</option>
                    <option>INFO</option>
                    <option>ERROR</option>
                </select>
            </div>

            {/* Scrollable Log Container */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ maxHeight: '650px', overflowY: 'auto' }}>
                    <div className="table-container">
                        <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                                <tr>
                                    <th style={{ width: '180px' }}>Timestamp</th>
                                    <th style={{ width: '140px' }}>Agent</th>
                                    <th style={{ width: '100px' }}>Type</th>
                                    <th>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log, i) => (
                                    <tr key={log.id || i}>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{log.agent_name}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {getStatusIcon(log.event_type)}
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{log.event_type}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                                            {log.message}
                                            {log.metadata?.error && (
                                                <div style={{ 
                                                    marginTop: '8px', 
                                                    padding: '8px', 
                                                    background: 'rgba(239, 68, 68, 0.05)', 
                                                    borderRadius: '6px', 
                                                    fontSize: '0.8rem',
                                                    color: 'var(--accent-red)',
                                                    border: '1px solid rgba(239, 68, 68, 0.1)'
                                                }}>
                                                    <code>{log.metadata.error}</code>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                                            No logs match your filter criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Logs;
