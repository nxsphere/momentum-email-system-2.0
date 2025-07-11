# 🎨 Grafana Dashboard Setup Guide

## ✅ **What's Already Done**
- ✅ Grafana is running at: http://localhost:3000
- ✅ Dashboard configuration ready: `grafana-dashboard.json`
- ✅ Login credentials: admin / momentum123

## 🚀 **Step-by-Step Setup**

### 1. **Apply Database Migration First** (If Not Done)
```
📋 Go to: https://supabase.com/dashboard/project/pxzccwwvzpvyceumnekw/sql
📄 Copy contents from: migration-to-apply.sql
🔧 Paste and click 'Run'
```

### 2. **Login to Grafana**
- 🌐 Open: http://localhost:3000
- 👤 Username: `admin`
- 🔐 Password: `momentum123`

### 3. **Add PostgreSQL Data Source**

**3.1 Navigate to Data Sources:**
- Click **⚙️ Configuration** (gear icon) in left sidebar
- Click **📊 Data sources**
- Click **+ Add data source**
- Select **PostgreSQL**

**3.2 Configure Connection:**
```
Host: db.pxzccwwvzpvyceumnekw.supabase.co:5432
Database: postgres
User: postgres
Password: [Your database password]
SSL Mode: require
Version: 12+
```

**3.3 Test Connection:**
- Click **Save & test**
- Should show green ✅ "Database Connection OK"

### 4. **Import Dashboard**

**4.1 Import Process:**
- Click **➕ Create** in left sidebar
- Click **📥 Import**
- Click **📎 Upload JSON file**
- Select: `grafana-dashboard.json`
- Click **Load**

**4.2 Configure Dashboard:**
- **Name**: "Momentum Email System - Complete Monitoring"
- **Data source**: Select the PostgreSQL source you just created
- Click **Import**

### 5. **Configure Environment Variable**
- In the dashboard, select **Environment**: `production`
- All panels should start showing data

## 📊 **Dashboard Features**

Your dashboard includes:

### **📈 System Overview**
- API Requests/sec
- Edge Function Invocations
- Database Connections
- Email Queue Size

### **📧 Email Performance**
- Queue metrics and trends
- Success rates and bounce rates
- Campaign performance

### **🗄️ Database Performance**
- Query duration (P95, P99)
- Connection pool health
- Transaction rates

### **⚡ Edge Function Metrics**
- Individual function performance
- Response times and errors
- Memory and CPU usage

### **🚨 Alerts & Health**
- Service health status
- Recent alerts and notifications
- System resource monitoring

## 🎯 **Pro Tips**

### **🔄 Auto-Refresh**
- Dashboard refreshes every 30 seconds
- You can change this in the top-right dropdown

### **📅 Time Range**
- Default: Last 1 hour
- Change using time picker (top-right)
- Try: Last 24 hours, Last 7 days

### **📱 Mobile Friendly**
- Dashboard works on mobile devices
- Panels stack vertically on smaller screens

### **🔔 Alerts Setup**
- Configure alert channels in Grafana
- Set up Slack/Email notifications
- Define custom alert rules

## 🛠️ **Troubleshooting**

### **❌ No Data Showing?**
1. Check database migration was applied
2. Verify environment variable is set to `production`
3. Ensure metrics collection is running
4. Check PostgreSQL connection settings

### **🔌 Connection Issues?**
1. Verify Supabase credentials
2. Check SSL mode is set to `require`
3. Ensure database user has read permissions

### **📊 Dashboard Import Failed?**
1. Ensure you're using the latest `grafana-dashboard.json`
2. Check PostgreSQL data source is configured first
3. Try importing manually via JSON paste

## 🎉 **You're All Set!**

Once configured, you'll have:
- ✅ Real-time infrastructure monitoring
- ✅ Beautiful visualizations
- ✅ Automated alerting
- ✅ Historical data analysis
- ✅ Professional monitoring dashboard

## 🔗 **Quick Links**
- 📊 Grafana: http://localhost:3000
- 🌐 Supabase Dashboard: https://supabase.com/dashboard/project/pxzccwwvzpvyceumnekw

---

**Need help?** Check the main documentation at `docs/INFRASTRUCTURE-MONITORING-SETUP.md`
