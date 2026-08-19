// Espelho manual dos dados semeados por backend/scripts/seed_dev_data.py.
//
// Decisão registrada em CLAUDE.md: GET /users e GET /categories não existem
// nesta fase — o frontend "consulta esses dados direto no Postgres", o que
// na prática significa que os IDs/nomes abaixo foram lidos do Neon e
// hardcoded aqui. Se o seed for rodado de novo em outro banco, os UUIDs
// mudam e este arquivo precisa ser atualizado à mão.

export interface TechnicianAccount {
  name: string;
  email: string;
}

// Senha é a mesma para todas as contas semeadas (ver seed_dev_data.py).
export const DEMO_PASSWORD = "demo1234";

export const TECHNICIANS: TechnicianAccount[] = [
  { name: "Carla Mendes", email: "carla.mendes@itsm.dev" },
  { name: "Rafael Souza", email: "rafael.souza@itsm.dev" },
];

export const CATEGORY_NAMES: Record<string, string> = {
  "e9aa1704-6d80-47db-975d-9ba6cbb709c9": "Hardware",
  "ad2e5f4e-9b3b-46b0-9646-683ff15bdd70": "Software",
  "0e4ac791-aa89-435d-b01f-abd24d290ab0": "Rede",
  "e8295c05-bb8d-4709-a93a-f4cd91c99e9c": "Acesso e Conta",
};

export const USER_NAMES: Record<string, string> = {
  "06849518-927d-458a-ac83-eff049eb82b0": "Carla Mendes",
  "98bb6abe-15ca-4dda-a8d2-3f03c566fc18": "Rafael Souza",
  "007cb854-e533-4417-a44e-27e7565f00d9": "Beatriz Lima",
  "08d7203b-517c-4988-ad51-2ad3ea3f4aa4": "João Pereira",
  "867206a1-db73-42e1-900e-b5b04d2ad40e": "Marina Alves",
};
