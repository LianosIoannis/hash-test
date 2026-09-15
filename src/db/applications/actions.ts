import prisma from "../prisma.js";

export type UpdateApplicationInput = {
	code?: string | undefined;
	name?: string | undefined;
	description?: string | null | undefined;
};

export async function createApplication(code: string, name: string, description?: string) {
	return prisma.application.create({
		data: {
			code,
			name,
			description: description ?? null,
		},
	});
}

export async function updateApplication(id: number, input: UpdateApplicationInput) {
	return prisma.application.update({
		where: { id },
		data: {
			...(input.code === undefined ? {} : { code: input.code }),
			...(input.name === undefined ? {} : { name: input.name }),
			...(input.description === undefined ? {} : { description: input.description }),
		},
	});
}

export async function deleteApplication(id: number) {
	return prisma.application.delete({
		where: { id },
	});
}
