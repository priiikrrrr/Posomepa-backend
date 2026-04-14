const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const HostApplication = require('../models/HostApplication');
const User = require('../models/User');
const emailService = require('../services/emailService');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_ALTERNATE_EMAIL = process.env.ADMIN_ALTERNATE_EMAIL;

// Simple session storage (in production, use Redis or database)
let adminSession = null;

// Auth middleware for admin routes
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!adminSession || adminSession.token !== token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  req.admin = adminSession;
  next();
};

// Serve static files
router.use(express.static(path.join(__dirname, '../public/admin')));

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check credentials against env variables
    if ((email === ADMIN_EMAIL || email === ADMIN_ALTERNATE_EMAIL) && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      adminSession = { email, role: 'admin', token };
      
      return res.json({ 
        success: true, 
        token,
        email,
        message: 'Login successful' 
      });
    }
    
    res.status(401).json({ message: 'Invalid credentials' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Admin Logout
router.post('/logout', (req, res) => {
  adminSession = null;
  res.json({ message: 'Logged out successfully' });
});

// Check admin status
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (adminSession && adminSession.token === token) {
    return res.json({ 
      authenticated: true, 
      email: adminSession.email 
    });
  }
  
  res.json({ authenticated: false });
});

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = {
      totalApplications: await HostApplication.countDocuments(),
      pending: await HostApplication.countDocuments({ status: 'pending' }),
      verified: await HostApplication.countDocuments({ status: 'verified' }),
      rejected: await HostApplication.countDocuments({ status: 'rejected' }),
      totalUsers: await User.countDocuments({ role: { $ne: 'admin' } }),
      verifiedHosts: await User.countDocuments({ hostApplicationStatus: 'verified' })
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to get stats' });
  }
});

// Get all applications
router.get('/applications', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const applications = await HostApplication.find(query)
      .populate('user', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await HostApplication.countDocuments(query);

    res.json({
      applications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Failed to get applications' });
  }
});

// Get single application
router.get('/applications/:id', adminAuth, async (req, res) => {
  try {
    const application = await HostApplication.findById(req.params.id)
      .populate('user', 'name email phone avatar');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Failed to get application' });
  }
});

// Approve application
router.post('/applications/:id/approve', adminAuth, async (req, res) => {
  try {
    const application = await HostApplication.findById(req.params.id)
      .populate('user', 'name email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Application has already been processed. Current status: ' + application.status 
      });
    }

    // Update application
    application.status = 'verified';
    application.verifiedAt = new Date();
    application.reviewedAt = new Date();
    await application.save();

    // Update user
    await User.findByIdAndUpdate(application.user._id, { 
      hostApplicationStatus: 'verified',
      role: 'host'
    });

    // Send email
    await emailService.sendApprovalEmail(application.email, application.fullName);

    res.json({
      success: true,
      message: 'Application approved and email sent',
      application
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ message: 'Failed to approve application' });
  }
});

// Reject application
router.post('/applications/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const application = await HostApplication.findById(req.params.id)
      .populate('user', 'name email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Application has already been processed. Current status: ' + application.status 
      });
    }

    // Update application
    application.status = 'rejected';
    application.rejectionReason = reason;
    application.rejectedAt = new Date();
    application.reviewedAt = new Date();
    application.canResubmitAt = new Date(Date.now() + 14 * 60 * 60 * 1000);
    await application.save();

    // Update user
    await User.findByIdAndUpdate(application.user._id, { 
      hostApplicationStatus: 'rejected'
    });

    // Send email
    await emailService.sendRejectionEmail(application.email, application.fullName, reason);

    res.json({
      success: true,
      message: 'Application rejected and email sent',
      application
    });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ message: 'Failed to reject application' });
  }
});

// Serve HTML pages
router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PosomePa Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; }
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-box { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 400px; }
    h1 { color: #8B5CF6; margin-bottom: 10px; font-size: 28px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #374151; font-weight: 500; }
    input { width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; }
    input:focus { outline: none; border-color: #8B5CF6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
    button { width: 100%; padding: 14px; background: #8B5CF6; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    button:hover { background: #7C3AED; }
    .error { color: #dc2626; margin-top: 15px; text-align: center; display: none; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo-icon { font-size: 48px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-box">
      <div class="logo">
        <div class="logo-icon">🏠</div>
        <h1>PosomePa Admin</h1>
        <p class="subtitle">Host Application Management</p>
      </div>
      <form id="loginForm">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="email" required placeholder="Enter admin email">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="password" required placeholder="Enter password">
        </div>
        <button type="submit">Sign In</button>
        <p class="error" id="error"></p>
      </form>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error');
      
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (data.success) {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminEmail', data.email);
          window.location.href = '/admin/dashboard';
        } else {
          errorEl.textContent = data.message || 'Login failed';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = 'Connection error';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>
  `);
});

router.get('/dashboard', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!adminSession || adminSession.token !== token) {
    return res.redirect('/admin');
  }
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PosomePa Admin - Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; }
    .header { background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 24px; }
    .logout-btn { background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
    .container { max-width: 1400px; margin: 0 auto; padding: 30px 40px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .stat-card .number { font-size: 36px; font-weight: 700; color: #8B5CF6; }
    .stat-card.pending .number { color: #F59E0B; }
    .stat-card.verified .number { color: #10B981; }
    .stat-card.rejected .number { color: #EF4444; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .tab { padding: 12px 24px; background: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; color: #666; }
    .tab.active { background: #8B5CF6; color: white; }
    .applications-list { background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); overflow: hidden; }
    .app-item { padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
    .app-item:hover { background: #f9fafb; }
    .app-item:last-child { border-bottom: none; }
    .app-info h4 { font-size: 16px; color: #111; margin-bottom: 5px; }
    .app-info p { color: #666; font-size: 14px; }
    .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-pending { background: #FEF3C7; color: #D97706; }
    .status-verified { background: #D1FAE5; color: #059669; }
    .status-rejected { background: #FEE2E2; color: #DC2626; }
    .empty { text-align: center; padding: 60px; color: #666; }
    .loading { text-align: center; padding: 40px; color: #666; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb; }
    .modal-header h2 { font-size: 20px; }
    .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
    .section { margin-bottom: 25px; }
    .section h3 { font-size: 14px; color: #666; text-transform: uppercase; margin-bottom: 10px; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-label { width: 150px; color: #666; }
    .detail-value { flex: 1; font-weight: 500; }
    .doc-preview { background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 10px; }
    .doc-preview img { max-width: 200px; max-height: 200px; border-radius: 4px; }
    .doc-preview a { display: inline-block; margin-top: 10px; color: #8B5CF6; text-decoration: none; }
    .action-buttons { display: flex; gap: 15px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .btn { padding: 14px 28px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn-approve { background: #10B981; color: white; }
    .btn-reject { background: #EF4444; color: white; }
    .btn-cancel { background: #6B7280; color: white; }
    .reject-form { display: none; margin-top: 20px; }
    .reject-form.active { display: block; }
    textarea { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; min-height: 100px; font-family: inherit; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏠 PosomePa Admin</h1>
    <button class="logout-btn" onclick="logout()">Logout</button>
  </div>
  
  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Applications</h3>
        <div class="number" id="stat-total">0</div>
      </div>
      <div class="stat-card pending">
        <h3>Pending</h3>
        <div class="number" id="stat-pending">0</div>
      </div>
      <div class="stat-card verified">
        <h3>Verified</h3>
        <div class="number" id="stat-verified">0</div>
      </div>
      <div class="stat-card rejected">
        <h3>Rejected</h3>
        <div class="number" id="stat-rejected">0</div>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="filterApps('all')">All</button>
      <button class="tab" onclick="filterApps('pending')">Pending</button>
      <button class="tab" onclick="filterApps('verified')">Verified</button>
      <button class="tab" onclick="filterApps('rejected')">Rejected</button>
    </div>
    
    <div class="applications-list" id="applications-list">
      <div class="loading">Loading applications...</div>
    </div>
  </div>
  
  <div class="modal" id="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Application Details</h2>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <div id="app-details"></div>
    </div>
  </div>

  <script>
    const token = localStorage.getItem('adminToken');
    
    async function api(url, options = {}) {
      const res = await fetch(url, {
        ...options,
        headers: { ...options.headers, 'Authorization': 'Bearer ' + token }
      });
      return res.json();
    }
    
    async function loadStats() {
      const stats = await api('/admin/stats');
      document.getElementById('stat-total').textContent = stats.totalApplications || 0;
      document.getElementById('stat-pending').textContent = stats.pending || 0;
      document.getElementById('stat-verified').textContent = stats.verified || 0;
      document.getElementById('stat-rejected').textContent = stats.rejected || 0;
    }
    
    let currentFilter = 'all';
    let applications = [];
    
    async function loadApplications() {
      const data = await api('/admin/applications?status=' + currentFilter);
      applications = data.applications || [];
      renderApplications();
    }
    
    function filterApps(filter) {
      currentFilter = filter;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      loadApplications();
    }
    
    function renderApplications() {
      const list = document.getElementById('applications-list');
      if (applications.length === 0) {
        list.innerHTML = '<div class="empty">No applications found</div>';
        return;
      }
      
      list.innerHTML = applications.map(app => \`
        <div class="app-item" onclick="viewApplication('\${app._id}')">
          <div class="app-info">
            <h4>\${app.fullName}</h4>
            <p>\${app.serviceType} • \${app.city} • \${new Date(app.createdAt).toLocaleDateString()}</p>
          </div>
          <span class="status-badge status-\${app.status}">\${app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span>
        </div>
      \`).join('');
    }
    
    async function viewApplication(id) {
      const { application } = await api('/admin/applications/' + id);
      const BASE_URL = window.location.origin;
      
      document.getElementById('app-details').innerHTML = \`
        <div class="section">
          <h3>Status</h3>
          <span class="status-badge status-\${application.status}">\${application.status.charAt(0).toUpperCase() + application.status.slice(1)}</span>
        </div>
        
        <div class="section">
          <h3>Basic Information</h3>
          <div class="detail-row"><span class="detail-label">Full Name</span><span class="detail-value">\${application.fullName}</span></div>
          <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">\${application.email}</span></div>
          \${application.alternateEmail ? '<div class="detail-row"><span class="detail-label">Alt Email</span><span class="detail-value">' + application.alternateEmail + '</span></div>' : ''}
          <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">\${application.phone}</span></div>
          \${application.alternatePhone ? '<div class="detail-row"><span class="detail-label">Alt Phone</span><span class="detail-value">' + application.alternatePhone + '</span></div>' : ''}
          <div class="detail-row"><span class="detail-label">Service Type</span><span class="detail-value">\${application.serviceType}</span></div>
          <div class="detail-row"><span class="detail-label">Area</span><span class="detail-value">\${application.area}</span></div>
        </div>
        
        <div class="section">
          <h3>Identity Verification</h3>
          <div class="detail-row"><span class="detail-label">ID Type</span><span class="detail-value">\${application.idType.toUpperCase()}</span></div>
          <div class="detail-row"><span class="detail-label">ID Number</span><span class="detail-value">\${application.idNumber}</span></div>
          <div class="doc-preview">
            <p><strong>ID Document:</strong></p>
            <img src="\${application.idImageUrl}" alt="ID" onerror="this.style.display='none'">
            <a href="\${application.idImageUrl}" target="_blank">View Full Size</a>
          </div>
        </div>
        
        <div class="section">
          <h3>Address</h3>
          <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">\${application.address}</span></div>
          <div class="detail-row"><span class="detail-label">City</span><span class="detail-value">\${application.city}</span></div>
          <div class="detail-row"><span class="detail-label">State</span><span class="detail-value">\${application.state}</span></div>
          <div class="detail-row"><span class="detail-label">Pincode</span><span class="detail-value">\${application.pincode}</span></div>
          \${application.addressProofUrl ? '<div class="doc-preview"><p><strong>Address Proof:</strong></p><img src="' + application.addressProofUrl + '" alt="Address Proof" onerror="this.style.display=\\'none\\'"><a href="' + application.addressProofUrl + '" target="_blank">View Full Size</a></div>' : ''}
        </div>
        
        <div class="section">
          <h3>Self Verification</h3>
          <div class="doc-preview">
            <img src="\${application.selfieUrl}" alt="Selfie" onerror="this.style.display='none'">
            <a href="\${application.selfieUrl}" target="_blank">View Full Size</a>
          </div>
        </div>
        
        \${application.businessProofUrl ? '<div class="section"><h3>Business Proof</h3><div class="doc-preview"><img src="' + application.businessProofUrl + '" alt="Business Proof" onerror="this.style.display=\\'none\\'"><a href="' + application.businessProofUrl + '" target="_blank">View Full Size</a></div></div>' : ''}
        
        \${application.rejectionReason ? '<div class="section"><h3>Rejection Reason</h3><div style="background:#FEE2E2;padding:15px;border-radius:8px;color:#DC2626;">' + application.rejectionReason + '</div></div>' : ''}
        
        \${application.status === 'pending' ? \`
          <div class="action-buttons">
            <button class="btn btn-approve" onclick="approveApplication('\${application._id}')">✓ Approve Application</button>
            <button class="btn btn-reject" onclick="showRejectForm()">✗ Reject Application</button>
          </div>
          <div class="reject-form" id="reject-form">
            <h3 style="margin:20px 0 10px;">Rejection Reason</h3>
            <textarea id="reject-reason" placeholder="Enter reason for rejection..."></textarea>
            <div class="action-buttons">
              <button class="btn btn-cancel" onclick="hideRejectForm()">Cancel</button>
              <button class="btn btn-reject" onclick="rejectApplication('\${application._id}')">Confirm Rejection</button>
            </div>
          </div>
        \` : ''}
      \`;
      
      document.getElementById('modal').classList.add('active');
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    
    function showRejectForm() {
      document.getElementById('reject-form').classList.add('active');
    }
    
    function hideRejectForm() {
      document.getElementById('reject-form').classList.remove('active');
    }
    
    async function approveApplication(id) {
      if (!confirm('Approve this application? An email will be sent to the applicant.')) return;
      const result = await api('/admin/applications/' + id + '/approve', { method: 'POST' });
      if (result.success) {
        alert('Application approved! Email sent.');
        closeModal();
        loadStats();
        loadApplications();
      } else {
        alert('Error: ' + result.message);
      }
    }
    
    async function rejectApplication(id) {
      const reason = document.getElementById('reject-reason').value.trim();
      if (!reason) {
        alert('Please enter a rejection reason');
        return;
      }
      const result = await api('/admin/applications/' + id + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (result.success) {
        alert('Application rejected! Email sent.');
        closeModal();
        loadStats();
        loadApplications();
      } else {
        alert('Error: ' + result.message);
      }
    }
    
    function logout() {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminEmail');
      window.location.href = '/admin';
    }
    
    // Check auth
    if (!token) {
      window.location.href = '/admin';
    } else {
      loadStats();
      loadApplications();
    }
  </script>
</body>
</html>
  `);
});

module.exports = router;
