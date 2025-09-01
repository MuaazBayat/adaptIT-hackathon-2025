sudo apt -y install postgresql
sudo -i -u postgres
\q
exit
sudo systemctl restart postgresql
sudo apt install git -y
git clone https://github.com/MuaazBayat/minaturn.git
apt install python3.11-venv