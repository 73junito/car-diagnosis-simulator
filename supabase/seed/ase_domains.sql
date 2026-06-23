insert into ase_domains (code, name, description) values
('A1','Engine Repair','Engine mechanical diagnosis and repair'),
('A2','Automatic Transmission','Automatic transmission and transaxle diagnosis'),
('A3','Manual Drive Train','Manual drivetrain and axle diagnosis'),
('A4','Suspension and Steering','Steering, suspension, and alignment diagnosis'),
('A5','Brakes','Brake system diagnosis and repair'),
('A6','Electrical/Electronic Systems','Electrical, starting, charging, and network diagnosis'),
('A7','Heating and Air Conditioning','Automotive HVAC diagnosis'),
('A8','Engine Performance','Fuel, ignition, emissions, and drivability diagnosis'),
('L3','Hybrid/EV','Hybrid and electric vehicle safety and diagnostics')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;
