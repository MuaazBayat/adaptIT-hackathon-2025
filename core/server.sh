#!/bin/bash

# MinaTurn Core Service Setup Script for Ubuntu VM
# Complete installation from scratch including PostgreSQL, Python, and all dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root"
   log_info "Please run as a regular user with sudo privileges"
   exit 1
fi

# Configuration variables
PROJECT_NAME="minaturn"
PROJECT_DIR="/opt/minaturn"
SERVICE_USER="minaturn"
DB_NAME="minaturn_db"
DB_USER="minaturn_user"
DB_PASSWORD="minaturn_secure_password_$(openssl rand -hex 8)"
PYTHON_VERSION="3.11"
GUNICORN_PORT="8001"

log_header "MinaTurn Core Service Setup"
log_info "Starting complete setup for Ubuntu VM"
log_info "Project will be installed to: $PROJECT_DIR"

# Update system
log_header "Updating System Packages"
sudo apt-get update
sudo apt-get upgrade -y

# Install system dependencies
log_header "Installing System Dependencies"
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    git \
    curl \
    wget \
    nginx \
    supervisor \
    postgresql \
    postgresql-contrib \
    libpq-dev \
    pkg-config \
    openssl \
    ufw \
    htop \
    vim \
    unzip

# Install specific Python version if needed
if ! python3.11 --version &>/dev/null; then
    log_info "Installing Python 3.11..."
    sudo apt-get install -y software-properties-common
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt-get update
    sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
fi

# Create service user
log_header "Creating Service User"
if ! id "$SERVICE_USER" &>/dev/null; then
    sudo useradd --system --shell /bin/bash --home-dir /var/lib/$SERVICE_USER --create-home $SERVICE_USER
    log_info "Created service user: $SERVICE_USER"
else
    log_info "Service user $SERVICE_USER already exists"
fi

# Create project directory
log_header "Setting Up Project Directory"
sudo mkdir -p $PROJECT_DIR
sudo chown $SERVICE_USER:$SERVICE_USER $PROJECT_DIR

# Setup PostgreSQL
log_header "Configuring PostgreSQL Database"
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
-- Drop existing database and user if they exist (for clean setup)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create new user and database
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;

-- Show created resources
\l
\du
EOF

log_info "PostgreSQL database setup complete"
log_info "Database: $DB_NAME"
log_info "User: $DB_USER"
log_info "Password: $DB_PASSWORD"

# Copy project files (assuming script is run from core directory)
log_header "Setting Up Project Files"
if [[ -f "requirements.txt" && -d "minaturn" ]]; then
    log_info "Copying project files..."
    sudo cp -r . $PROJECT_DIR/
    sudo chown -R $SERVICE_USER:$SERVICE_USER $PROJECT_DIR
    log_info "Project files copied successfully"
else
    log_error "Project files not found. Please run this script from the core directory."
    exit 1
fi

# Create Python virtual environment
log_header "Setting Up Python Virtual Environment"
sudo -u $SERVICE_USER python3.11 -m venv $PROJECT_DIR/venv
log_info "Virtual environment created"

# Install Python dependencies
log_info "Installing Python packages..."
sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/pip install --upgrade pip
sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/pip install -r $PROJECT_DIR/requirements.txt
log_info "Python packages installed successfully"

# Create .env file
log_header "Creating Environment Configuration"
sudo -u $SERVICE_USER tee $PROJECT_DIR/.env > /dev/null <<EOF
# Django Configuration
DEBUG=False
SECRET_KEY=$(openssl rand -base64 50)
ALLOWED_HOSTS=localhost,127.0.0.1,$(hostname -I | awk '{print $1}')

# Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# WhatsApp Business API Configuration (update these with your actual values)
WHATSAPP_API_URL=https://graph.facebook.com/v23.0/YOUR_PHONE_NUMBER_ID/messages
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here

# Security
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF

sudo chown $SERVICE_USER:$SERVICE_USER $PROJECT_DIR/.env
sudo chmod 600 $PROJECT_DIR/.env
log_info "Environment file created"

# Run Django migrations
log_header "Setting Up Database Schema"
cd $PROJECT_DIR
sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/python manage.py makemigrations
sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/python manage.py migrate
log_info "Database migrations completed"

# Create Django superuser (optional)
log_info "Creating Django superuser (optional - press Ctrl+C to skip)..."
sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/python manage.py createsuperuser --noinput --username admin --email admin@minaturn.local || log_warn "Superuser creation skipped"

# Collect static files
sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/python manage.py collectstatic --noinput
log_info "Static files collected"

# Create logs directory
sudo mkdir -p $PROJECT_DIR/logs
sudo chown $SERVICE_USER:$SERVICE_USER $PROJECT_DIR/logs
sudo chmod 755 $PROJECT_DIR/logs

# Create Gunicorn configuration
log_header "Configuring Gunicorn Application Server"
sudo -u $SERVICE_USER tee $PROJECT_DIR/gunicorn.conf.py > /dev/null <<EOF
import multiprocessing

# Server socket
bind = "0.0.0.0:$GUNICORN_PORT"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Restart workers after this many requests, with up to this much jitter
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "$PROJECT_DIR/logs/gunicorn_access.log"
errorlog = "$PROJECT_DIR/logs/gunicorn_error.log"
loglevel = "info"
access_log_format = '%h %l %u %t "%r" %s %b "%{Referer}i" "%{User-Agent}i"'

# Process naming
proc_name = '$PROJECT_NAME'

# Server mechanics
daemon = False
pidfile = "/var/run/gunicorn/$PROJECT_NAME.pid"
user = "$SERVICE_USER"
group = "$SERVICE_USER"
tmp_upload_dir = None

# SSL (uncomment and configure if needed)
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"
EOF

# Create Gunicorn PID directory
sudo mkdir -p /var/run/gunicorn
sudo chown $SERVICE_USER:$SERVICE_USER /var/run/gunicorn

# Create systemd service file
log_header "Creating Systemd Service"
sudo tee /etc/systemd/system/minaturn.service > /dev/null <<EOF
[Unit]
Description=MinaTurn Django Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=notify
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
Environment=PATH=$PROJECT_DIR/venv/bin
ExecStart=$PROJECT_DIR/venv/bin/gunicorn minaturn.wsgi:application -c $PROJECT_DIR/gunicorn.conf.py
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=$PROJECT_DIR/logs /var/run/gunicorn
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx reverse proxy
log_header "Configuring Nginx Reverse Proxy"
sudo tee /etc/nginx/sites-available/minaturn > /dev/null <<EOF
upstream minaturn_backend {
    server 127.0.0.1:$GUNICORN_PORT fail_timeout=0;
}

server {
    listen 80;
    server_name $(hostname -I | awk '{print $1}') localhost;
    
    client_max_body_size 4G;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Logging
    access_log /var/log/nginx/minaturn_access.log;
    error_log /var/log/nginx/minaturn_error.log;
    
    # Static files
    location /static/ {
        alias $PROJECT_DIR/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias $PROJECT_DIR/media/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Main application
    location / {
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Host \$http_host;
        proxy_redirect off;
        proxy_pass http://minaturn_backend;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/minaturn /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configure UFW firewall
log_header "Configuring Firewall"
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow $GUNICORN_PORT
log_info "Firewall configured"

# Start and enable services
log_header "Starting Services"
sudo systemctl daemon-reload
sudo systemctl enable minaturn
sudo systemctl start minaturn
sudo systemctl status minaturn --no-pager

# Create useful scripts
log_header "Creating Management Scripts"

# Create backup script
sudo tee /usr/local/bin/minaturn-backup > /dev/null <<EOF
#!/bin/bash
# MinaTurn Database Backup Script
BACKUP_DIR="/var/backups/minaturn"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR
sudo -u postgres pg_dump $DB_NAME > \$BACKUP_DIR/minaturn_backup_\$DATE.sql
gzip \$BACKUP_DIR/minaturn_backup_\$DATE.sql
echo "Backup created: \$BACKUP_DIR/minaturn_backup_\$DATE.sql.gz"
find \$BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

# Create log rotation script
sudo tee /usr/local/bin/minaturn-logs > /dev/null <<EOF
#!/bin/bash
# MinaTurn Log Management Script
case "\$1" in
    tail)
        tail -f $PROJECT_DIR/logs/minaturn.log
        ;;
    errors)
        tail -f $PROJECT_DIR/logs/errors.log
        ;;
    gunicorn)
        tail -f $PROJECT_DIR/logs/gunicorn_error.log
        ;;
    nginx)
        tail -f /var/log/nginx/minaturn_error.log
        ;;
    *)
        echo "Usage: \$0 {tail|errors|gunicorn|nginx}"
        echo "  tail     - Show application logs"
        echo "  errors   - Show error logs"
        echo "  gunicorn - Show Gunicorn logs"
        echo "  nginx    - Show Nginx logs"
        ;;
esac
EOF

# Create service management script
sudo tee /usr/local/bin/minaturn-service > /dev/null <<EOF
#!/bin/bash
# MinaTurn Service Management Script
case "\$1" in
    start)
        sudo systemctl start minaturn
        ;;
    stop)
        sudo systemctl stop minaturn
        ;;
    restart)
        sudo systemctl restart minaturn
        ;;
    status)
        sudo systemctl status minaturn
        ;;
    logs)
        sudo journalctl -u minaturn -f
        ;;
    deploy)
        cd $PROJECT_DIR
        git pull
        sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/python manage.py migrate
        sudo -u $SERVICE_USER $PROJECT_DIR/venv/bin/python manage.py collectstatic --noinput
        sudo systemctl restart minaturn
        echo "Deployment complete"
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|status|logs|deploy}"
        ;;
esac
EOF

# Make scripts executable
sudo chmod +x /usr/local/bin/minaturn-*

# Setup log rotation
sudo tee /etc/logrotate.d/minaturn > /dev/null <<EOF
$PROJECT_DIR/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        systemctl reload minaturn
    endscript
}
EOF

# Final system information
log_header "Installation Complete!"

echo -e "${GREEN}✅ MinaTurn Core Service Setup Complete${NC}\n"

log_info "Service Status:"
sudo systemctl is-active minaturn nginx postgresql

log_info "Database Information:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"

log_info "Service Endpoints:"
echo "  HTTP: http://$(hostname -I | awk '{print $1}')/"
echo "  Direct: http://$(hostname -I | awk '{print $1}'):$GUNICORN_PORT/"
echo "  USSD Callback: http://$(hostname -I | awk '{print $1}')/ussd/callback/"

log_info "Management Commands:"
echo "  Service: minaturn-service {start|stop|restart|status|logs|deploy}"
echo "  Logs: minaturn-logs {tail|errors|gunicorn|nginx}"
echo "  Backup: minaturn-backup"

log_info "Configuration Files:"
echo "  Environment: $PROJECT_DIR/.env"
echo "  Gunicorn: $PROJECT_DIR/gunicorn.conf.py"
echo "  Systemd: /etc/systemd/system/minaturn.service"
echo "  Nginx: /etc/nginx/sites-available/minaturn"

log_warn "Next Steps:"
echo "1. Update WhatsApp API credentials in $PROJECT_DIR/.env"
echo "2. Configure your domain/SSL if needed"
echo "3. Test the USSD callback endpoint"
echo "4. Set up monitoring and backups"

log_info "Log files are available at: $PROJECT_DIR/logs/"
log_info "View live logs with: minaturn-logs tail"

echo -e "\n${GREEN}🚀 MinaTurn is now running at http://$(hostname -I | awk '{print $1}')/${NC}"