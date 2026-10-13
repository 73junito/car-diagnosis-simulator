insert into diagnostic_domains (code, name, description) values
('ENGINE_REPAIR','Engine Repair','Engine mechanical diagnosis and repair'),
('AUTOMATIC_TRANSMISSION','Automatic Transmission','Automatic transmission and transaxle diagnosis'),
('MANUAL_DRIVETRAIN','Manual Drive Train','Manual drivetrain and axle diagnosis'),
('SUSPENSION_STEERING','Suspension and Steering','Steering, suspension, and alignment diagnosis'),
('BRAKES','Brakes','Brake system diagnosis and repair'),
('ELECTRICAL','Electrical/Electronic Systems','Electrical, starting, charging, and network diagnosis'),
('HVAC','Heating and Air Conditioning','Automotive HVAC diagnosis'),
('ENGINE_PERFORMANCE','Engine Performance','Fuel, ignition, emissions, and drivability diagnosis'),
('HYBRID_EV','Hybrid/EV','Hybrid and electric vehicle safety and diagnostics')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;
