    -- Seed: definir marcelo@welcometrips.com.br como admin
    -- Busca o user_id na tabela auth.users pelo email e insere na user_roles
    INSERT INTO user_roles (user_id, role)
    SELECT id, 'admin'
    FROM auth.users
    WHERE email = 'marcelo@welcometrips.com.br'
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = now();
