/**
 * 🚀 GOD MODE+ v3 - Model Performance Dashboard
 * Real-time visualization of AI model performance metrics
 */

'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Zap, TrendingUp, Clock, DollarSign } from 'lucide-react';
import clsx from 'clsx';

interface ModelMetrics {
  model: string;
  provider: string;
  successRate: number;
  avgLatency: number;
  costPer1k: number;
  requestsProcessed: number;
  lastUsed: string;
}

interface PerformanceData {
  timestamp: string;
  model: string;
  latency: number;
  success: boolean;
  cost: number;
}

export default function ModelPerformanceDashboard() {
  const [metrics, setMetrics] = useState<ModelMetrics[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceData[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch model metrics from backend
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/v1/agents/model-metrics');
        const data = await response.json();
        setMetrics(data.metrics || []);
        setPerformanceHistory(data.history || []);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const filteredHistory = selectedModel === 'all'
    ? performanceHistory
    : performanceHistory.filter(d => d.model === selectedModel);

  const modelStats = metrics.map(m => ({
    name: m.model,
    successRate: m.successRate,
    latency: m.avgLatency,
    requests: m.requestsProcessed,
  }));

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Model Performance Dashboard
          </h2>
          <p className="text-slate-400 text-sm mt-1">Real-time AI model metrics and analytics</p>
        </div>
      </div>

      {/* Model Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedModel('all')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-all',
            selectedModel === 'all'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          )}
        >
          All Models
        </button>
        {metrics.map(m => (
          <button
            key={m.model}
            onClick={() => setSelectedModel(m.model)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-all',
              selectedModel === m.model
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            {m.model}
          </button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(metric => (
          <div
            key={metric.model}
            className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-4 hover:border-blue-400 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-300">{metric.model}</p>
                <p className="text-xs text-slate-500">{metric.provider}</p>
              </div>
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                {metric.successRate}%
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Latency
                </span>
                <span className="text-white font-mono">{metric.avgLatency}ms</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Cost/1K
                </span>
                <span className="text-white font-mono">${metric.costPer1k.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Requests
                </span>
                <span className="text-white font-mono">{metric.requestsProcessed}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-xs text-slate-500">
                Last used: {new Date(metric.lastUsed).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success Rate Chart */}
        <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Success Rate by Model</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={modelStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="successRate" fill="#10b981" name="Success Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Latency Chart */}
        <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Average Latency</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={modelStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="latency" fill="#3b82f6" name="Latency (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance History */}
      <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Performance Timeline</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={filteredHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis
              dataKey="timestamp"
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
            />
            <YAxis stroke="#94a3b8" yAxisId="left" />
            <YAxis stroke="#94a3b8" yAxisId="right" orientation="right" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="latency"
              stroke="#3b82f6"
              name="Latency (ms)"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cost"
              stroke="#f59e0b"
              name="Cost ($)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-300 mb-2">Legend:</p>
        <ul className="space-y-1">
          <li>• <strong>Success Rate:</strong> Percentage of successful API calls</li>
          <li>• <strong>Latency:</strong> Average response time in milliseconds</li>
          <li>• <strong>Cost/1K:</strong> Price per 1000 tokens</li>
          <li>• <strong>Requests:</strong> Total number of requests processed</li>
        </ul>
      </div>
    </div>
  );
}
