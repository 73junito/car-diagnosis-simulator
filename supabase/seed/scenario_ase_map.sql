insert into scenario_ase_map (scenario_id, ase_code, weight) values
('no-crank','A6',1),
('no-start','A8',1),
('overheating','A1',1),
('electrical-load','A6',1),
('misfire','A8',1),
('steering-alignment','A4',1),
('hvac-cooling','A7',1),
('stalling','A8',1),
('misfire-9','A8',1),
('power-loss','A8',1),
('no-crank-11','A6',1),
('intermittent-starting','A6',1),
('charging-system','A6',1),
('can-bus-network','A6',1),
('hybrid-ev','L3',1),
('diesel-aftertreatment','A8',1),
('hybrid-ev-17','L3',1)
on conflict (scenario_id, ase_code) do update set
  weight = excluded.weight;
