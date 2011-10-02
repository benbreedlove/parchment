/*

Z-Machine disassembler - disassembles zcode into an AST
=======================================================

Copyright (c) 2011 The ifvms.js team
BSD licenced
http://github.com/curiousdannii/ifvms.js

*/

/*

Note:
	Nothing is done to check whether an instruction actually has a valid number of operands. Extras will usually be ignored while missing operands may throw errors at either the code building stage or when the JIT code is called.

TODO:
	implement proper errors for missing opcodes
	
*/

// The disassembler function
var disassemble = function( engine )
{
	var pc, offset, // Set in the loop below
	memory = engine.m,
	temp,
	code,
	opcode_class,
	operands_type, // The types of the operands, or -1 for var instructions
	operands,
	
	// Create the context for this code fragment
	context = new RoutineContext( engine, engine.pc );
	
	// Set the context's root context to be itself, and add it to the list of subcontexts
	//context.root = context;
	//context.contexts[0] = context;
	
	// Run through until we can no more
	while (1)
	{		
		// This instruction
		pc = engine.pc;
		offset = pc;
		code = memory.getUint8( pc++ );
		
		// Extended instructions
		if ( code == 190 )
		{
			operands_type = -1;
			code = memory.getUint8( pc++ ) + 1000;
		}
		
		else if ( code & 0x80 )
		{
			// Variable form instructions
			if ( code & 0x40 )
			{
				operands_type = -1;
				// 2OP instruction with VAR parameters
				if ( !(code & 0x20) )
				{
					code &= 0x1F;
				}
			}
			
			// Short form instructions
			else
			{
				operands_type = [ (code & 0x30) >> 4 ];
				// Clear the operand type if 1OP, keep for 0OPs
				if ( operands_type[0] < 3 )
				{
					code &= 0xCF;
				}
			}
		}
		
		// Long form instructions
		else
		{
			operands_type = [ code & 0x40 ? 2 : 1, code & 0x20 ? 2 : 1 ];
			code &= 0x1F;
		}
		
		// Check for missing opcodes
		// TODO: implement proper errors here
		if ( !opcodes[code] )
		{
			log('Missing opcode #' + code + ' at pc=' + offset);
			engine.stop = 1;
			console.log( context.write() );
			throw Error;
		}
		
		// Variable for quicker access to the opcode flags
		opcode_class = opcodes[code].prototype;
		
		// Variable form operand types
		if ( operands_type == -1 )
		{
			operands_type = [];
			get_var_operand_types( memory.getUint8(pc++), operands_type );
			
			// VAR_LONG opcodes have two operand type bytes
			if ( code == 236 || code == 250 )
			{
				get_var_operand_types( memory.getUint8(pc++), operands_type );
			}
		}
		
		// Load the operands
		operands = [];
		temp = 0;
		while ( temp < operands_type.length )
		{
			// Large constant
			if ( operands_type[temp] == 0 )
			{
				operands.push( new Operand( engine, memory.getUint16(pc) ) );
				pc += 2;
			}
			
			// Small constant
			if ( operands_type[temp] == 1 )
			{
				operands.push( new Operand( engine, memory.getUint8(pc++) ) );
			}
			
			// Variable operand
			if ( operands_type[temp++] == 2 )
			{
				operands.push( new Variable( engine, memory.getUint8(pc++) ) );
			}
		}
		
		// Check for a store variable
		if ( opcode_class.storer )
		{
			operands.push( new Variable( engine, memory.getUint8(pc++) ) );
		}
		
		// Check for a branch address
		// If we don't calculate the offset now we won't be able to tell the difference between 0x40 and 0x0040
		if ( opcode_class.brancher )
		{
			temp = memory.getUint8( pc++ );
			operands.push( [
				temp & 0x80, // iftrue
				temp & 0x40 ?
					// single byte address
					temp & 0x3F :
					// word address, but first get the second byte of it
					( ( temp = (temp << 8) | memory.getUint8(pc++) ) & 0x2000 ? ~0x1FFF : 0 ) | ( temp & 0x1FFF )
			] );
		}
		
		// Check for a text literal
		if ( opcode_class.printer )
		{
			temp = engine.text.decode( pc );
			operands.push( engine.text.escape( temp[0] ) );
			pc += temp[1];
		}
		
		// Update the engine's pc
		engine.pc = pc;
		
		// Create the instruction
		context.ops.push( new opcodes[code]( engine, context, code, offset, pc, operands ) );
		
		// Check for the end of a large if block
		temp = 0;
		if ( context.targets.indexOf( pc ) >= 0 )
		{
			temp = idiom_if_block( context, pc );
		}
		
		// We can't go any further if we have a final stopper :(
		if ( opcode_class.stopper && temp == 0 )
		{
			break;
		}
	}
	
	return context;
},

// Utility function to unpack the variable form operand types byte
get_var_operand_types = function( operands_byte, operands_type )
{
	for ( var i = 0; i < 4; i++ )
	{
		operands_type.push( (operands_byte & 0xC0) >> 6 );
		operands_byte <<= 2;
	}
};