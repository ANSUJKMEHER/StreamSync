const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  code: number;
}

export const executionService = {
  async executeCode(code: string, language: string, token: string): Promise<ExecutionResult> {
    const res = await fetch(`${API_BASE}/api/v1/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, language }),
    });
    
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Execution failed');
    }
    
    return json.data as ExecutionResult;
  }
};

